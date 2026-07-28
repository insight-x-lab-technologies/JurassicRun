import { beatsToSeconds, type MusicTrack } from './tracks';
import { MUSIC_SCORES, voicesForBar, type MusicTheme, type Voice } from './music';
import { SFX_CATALOG, sfxDetune, type SfxId } from './sfx';
import { musicFileUrl } from './musicSource';

export interface AudioEngine {
  resume(): Promise<void>;
  playSfx(id: SfxId, gain: number): void;
  /** Troca/seta a faixa em loop (recomeça do início) no tema dado. */
  playMusic(track: MusicTrack, gain: number, theme: MusicTheme): void;
  stopMusic(): void;
  /** Ajusta o ganho da faixa corrente sem reiniciá-la. */
  setMusicGain(gain: number): void;
  readonly running: MusicTrack | null;
  readonly runningTheme: MusicTheme | null;
}

/** Engine no-op que registra chamadas — para testes e fallback fora do browser. */
export interface RecordingAudioEngine extends AudioEngine {
  readonly musicStarts: MusicTrack[];
  readonly themeStarts: MusicTheme[];
  readonly sfxPlayed: SfxId[];
  stops: number;
  lastMusicGain: number;
  resumed: boolean;
}

export function nullAudioEngine(): RecordingAudioEngine {
  let running: MusicTrack | null = null;
  let theme: MusicTheme | null = null;
  const engine: RecordingAudioEngine = {
    musicStarts: [],
    themeStarts: [],
    sfxPlayed: [],
    stops: 0,
    lastMusicGain: 0,
    resumed: false,
    get running(): MusicTrack | null {
      return running;
    },
    get runningTheme(): MusicTheme | null {
      return theme;
    },
    resume(): Promise<void> {
      engine.resumed = true;
      return Promise.resolve();
    },
    playSfx(id: SfxId): void {
      engine.sfxPlayed.push(id);
    },
    playMusic(track: MusicTrack, gain: number, nextTheme: MusicTheme): void {
      running = track;
      theme = nextTheme;
      engine.musicStarts.push(track);
      engine.themeStarts.push(nextTheme);
      engine.lastMusicGain = gain;
    },
    setMusicGain(gain: number): void {
      engine.lastMusicGain = gain;
    },
    stopMusic(): void {
      running = null;
      theme = null;
      engine.stops += 1;
    },
  };
  return engine;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.35; // ≥ 1 compasso de folga p/ agendar por compasso
const NOISE_BUFFER_SEC = 2;
/** Fade da trilha de arquivo: entra em `startFile`, sai em `stopMusic`. */
const FILE_FADE_SEC = 0.4;

/** Casca WebAudio real: buses de música/SFX, ruído branco cacheado, scheduler por compasso. */
export class WebAudioEngine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private _running: MusicTrack | null = null;
  private _theme: MusicTheme | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarTime = 0;
  private barIndex = 0;
  private sfxCount = 0;
  private readonly voiceScratch: Voice[] = [];
  private readonly baseUrl: string = import.meta.env.BASE_URL;
  private readonly fileBuffers = new Map<string, AudioBuffer>();
  private readonly missingFiles = new Set<string>();
  private fileSource: AudioBufferSourceNode | null = null;
  private fileGain: GainNode | null = null;
  /** Token da reprodução corrente: um fetch que resolve tarde não pode ressuscitar faixa antiga. */
  private playToken = 0;

  get running(): MusicTrack | null {
    return this._running;
  }

  get runningTheme(): MusicTheme | null {
    return this._theme;
  }

  private ensureCtx(): AudioContext {
    if (this.ctx === null) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      // Limiter no destino: música e SFX somam no mesmo barramento e cada camada nova (packs,
      // SFX futuros) aumenta o pico. O compressor segura o estouro sem precisar re-tunar ganhos.
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -6;
      master.ratio.value = 12;
      master.attack.value = 0.003;
      master.release.value = 0.25;
      master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(master);
      // Ruído branco cacheado (kick/snare/hat/whooshes reusam este buffer).
      const frames = Math.floor(ctx.sampleRate * NOISE_BUFFER_SEC);
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buf.getChannelData(0);
      // LCG (sem Math.random): ruído idêntico a cada carga, reprodutível.
      let s = 22222;
      for (let i = 0; i < frames; i += 1) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        data[i] = s / 0x7fffffff - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  setMusicGain(gain: number): void {
    if (this.ctx !== null && this.musicBus !== null) {
      this.musicBus.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }
  }

  playMusic(track: MusicTrack, gain: number, theme: MusicTheme): void {
    const ctx = this.ensureCtx();
    this.stopMusic();
    const token = this.playToken; // capturado APÓS stopMusic (que já incrementou o anterior)
    this._running = track;
    this._theme = theme;
    if (this.musicBus !== null) this.musicBus.gain.value = gain;
    this.nextBarTime = ctx.currentTime + 0.08;
    this.barIndex = 0;
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
    // Trilha de arquivo (Suno) é opcional: some ⇒ segue procedural, sem quebrar nada.
    void this.tryFile(track, theme, token);
  }

  stopMusic(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Fade-out curto antes de cortar: `stop()` seco no meio de uma onda estala (o procedural não
    // sofre disso porque cada nota já tem envelope próprio). Os nós se auto-desconectam no `stop`.
    if (this.fileSource !== null && this.ctx !== null) {
      const src = this.fileSource;
      const g = this.fileGain;
      const end = this.ctx.currentTime + FILE_FADE_SEC;
      if (g !== null) {
        g.gain.cancelScheduledValues(this.ctx.currentTime);
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
      }
      src.stop(end);
      src.onended = (): void => {
        src.disconnect();
        g?.disconnect();
      };
    }
    this.fileSource = null;
    this.fileGain = null;
    this._running = null;
    this._theme = null;
    this.playToken += 1;
  }

  private async tryFile(track: MusicTrack, theme: MusicTheme, token: number): Promise<void> {
    const ctx = this.ctx;
    if (ctx === null) return;
    const url = musicFileUrl(theme, track, this.baseUrl);
    if (this.missingFiles.has(url)) return;
    let buffer = this.fileBuffers.get(url);
    if (buffer === undefined) {
      try {
        const res = await fetch(url);
        // Um host com fallback de SPA (vite preview, GitHub Pages com 404.html) responde 200 +
        // index.html para um caminho inexistente. Sem esta checagem, o HTML iria parar no
        // `decodeAudioData` — funciona (a exceção cai no catch), mas baixa a página inteira à toa.
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || type.includes('text/html')) {
          this.missingFiles.add(url);
          return;
        }
        buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        this.fileBuffers.set(url, buffer);
      } catch {
        this.missingFiles.add(url); // offline/404/formato inválido ⇒ procedural para sempre
        return;
      }
    }
    if (token !== this.playToken || this.musicBus === null) return; // trocou de faixa no meio
    this.startFile(buffer);
  }

  /** Crossfade 0,4 s: arquivo entra, camada procedural para. */
  private startFile(buffer: AudioBuffer): void {
    const ctx = this.ctx;
    if (ctx === null || this.musicBus === null) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + FILE_FADE_SEC);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(g);
    g.connect(this.musicBus);
    src.start();
    this.fileSource = src;
    this.fileGain = g;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    } // para o procedural
  }

  private scheduler(): void {
    const ctx = this.ctx;
    if (ctx === null || this._running === null || this._theme === null) return;
    const score = MUSIC_SCORES[this._theme][this._running];
    const barSeconds = beatsToSeconds(score.beatsPerBar, score.bpm);
    while (this.nextBarTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      voicesForBar(score, this.barIndex, this.voiceScratch);
      for (const v of this.voiceScratch) {
        const when = this.nextBarTime + beatsToSeconds(v.startBeat, score.bpm);
        const dur = beatsToSeconds(v.durBeats, score.bpm);
        this.scheduleVoice(v, when, dur);
      }
      this.nextBarTime += barSeconds;
      this.barIndex += 1;
    }
  }

  private scheduleVoice(v: Voice, when: number, dur: number): void {
    if (v.timbre === 'kick') {
      this.scheduleKick(when, v.gain);
      return;
    }
    if (v.timbre === 'snare') {
      this.scheduleNoiseHit(when, v.gain, 1800, 0.18);
      return;
    }
    if (v.timbre === 'hat') {
      this.scheduleNoiseHit(when, v.gain, 8000, 0.05);
      return;
    }
    this.scheduleTone(v.timbre, v.freq, when, dur, v.gain, this.musicBus);
  }

  /** Tom com envelope AD e glide opcional; `bus` = musicBus ou sfxBus. */
  private scheduleTone(
    type: OscillatorType,
    freq: number,
    when: number,
    dur: number,
    gain: number,
    bus: GainNode | null,
    freqEnd?: number,
    detuneCents = 0,
  ): void {
    const ctx = this.ctx;
    if (ctx === null || bus === null) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    osc.detune.value = detuneCents;
    if (freqEnd !== undefined && freqEnd > 0) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, when + dur);
    }
    const attack = Math.min(0.012, dur * 0.3);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  /** Ruído filtrado (hat/snare/whoosh). */
  private scheduleNoiseHit(
    when: number,
    gain: number,
    filterHz: number,
    dur: number,
    bus: GainNode | null = this.musicBus,
  ): void {
    const ctx = this.ctx;
    if (ctx === null || bus === null || this.noiseBuffer === null) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  /** Bumbo: seno com queda rápida de frequência. */
  private scheduleKick(when: number, gain: number): void {
    const ctx = this.ctx;
    if (ctx === null || this.musicBus === null) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + 0.25);
  }

  playSfx(id: SfxId, gain: number): void {
    const ctx = this.ensureCtx();
    void ctx.resume();
    const spec = SFX_CATALOG[id];
    const detune = sfxDetune(id, this.sfxCount);
    this.sfxCount += 1;
    const now = ctx.currentTime + 0.005;
    for (const layer of spec.layers) {
      const when = now + layer.delaySec;
      const dur = layer.attackSec + layer.decaySec;
      const amp = gain * layer.gain;
      if (layer.timbre === 'noise') {
        this.scheduleNoiseHit(when, amp, layer.filterHz ?? 2000, dur, this.sfxBus);
      } else if (layer.timbre === 'kick' || layer.timbre === 'snare' || layer.timbre === 'hat') {
        this.scheduleNoiseHit(when, amp, layer.filterHz ?? 4000, dur, this.sfxBus);
      } else {
        this.scheduleTone(layer.timbre, layer.freq, when, dur, amp, this.sfxBus, layer.freqEnd, detune);
      }
    }
  }
}
