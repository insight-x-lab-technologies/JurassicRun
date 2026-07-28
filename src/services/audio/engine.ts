import { beatsToSeconds, type MusicTrack } from './tracks';
import { MUSIC_SCORES, voicesForBar, type Voice } from './music';
import { SFX_CATALOG, type SfxId } from './sfx';

export interface AudioEngine {
  resume(): Promise<void>;
  playSfx(id: SfxId, gain: number): void;
  /** Troca/seta a faixa em loop (recomeça do início). */
  playMusic(track: MusicTrack, gain: number): void;
  stopMusic(): void;
  /** Ajusta o ganho da faixa corrente sem reiniciá-la. */
  setMusicGain(gain: number): void;
  readonly running: MusicTrack | null;
}

/** Engine no-op que registra chamadas — para testes e fallback fora do browser. */
export interface RecordingAudioEngine extends AudioEngine {
  readonly musicStarts: MusicTrack[];
  readonly sfxPlayed: SfxId[];
  stops: number;
  lastMusicGain: number;
  resumed: boolean;
}

export function nullAudioEngine(): RecordingAudioEngine {
  let running: MusicTrack | null = null;
  const engine: RecordingAudioEngine = {
    musicStarts: [],
    sfxPlayed: [],
    stops: 0,
    lastMusicGain: 0,
    resumed: false,
    get running(): MusicTrack | null {
      return running;
    },
    resume(): Promise<void> {
      engine.resumed = true;
      return Promise.resolve();
    },
    playSfx(id: SfxId): void {
      engine.sfxPlayed.push(id);
    },
    playMusic(track: MusicTrack, gain: number): void {
      running = track;
      engine.musicStarts.push(track);
      engine.lastMusicGain = gain;
    },
    setMusicGain(gain: number): void {
      engine.lastMusicGain = gain;
    },
    stopMusic(): void {
      running = null;
      engine.stops += 1;
    },
  };
  return engine;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

/** Casca WebAudio real. Placeholder procedural (osciladores); verificada no browser. */
export class WebAudioEngine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGainNode: GainNode | null = null;
  private _running: MusicTrack | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarTime = 0;
  private barIndex = 0;
  private readonly voiceScratch: Voice[] = [];

  get running(): MusicTrack | null {
    return this._running;
  }

  private ensureCtx(): AudioContext {
    if (this.ctx === null) {
      this.ctx = new AudioContext();
      this.musicGainNode = this.ctx.createGain();
      this.musicGainNode.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  setMusicGain(gain: number): void {
    if (this.ctx !== null && this.musicGainNode !== null) {
      this.musicGainNode.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }
  }

  playMusic(track: MusicTrack, gain: number): void {
    const ctx = this.ensureCtx();
    this.stopMusic();
    this._running = track;
    if (this.musicGainNode !== null) this.musicGainNode.gain.value = gain;
    this.nextBarTime = ctx.currentTime + 0.05;
    this.barIndex = 0;
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  stopMusic(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._running = null;
  }

  private scheduler(): void {
    if (this.ctx === null || this._running === null || this.musicGainNode === null) return;
    const score = MUSIC_SCORES.classic[this._running];
    const barSeconds = beatsToSeconds(score.beatsPerBar, score.bpm);
    while (this.nextBarTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      voicesForBar(score, this.barIndex, this.voiceScratch);
      for (const v of this.voiceScratch) {
        if (v.timbre === 'kick' || v.timbre === 'snare' || v.timbre === 'hat') continue;
        const when = this.nextBarTime + beatsToSeconds(v.startBeat, score.bpm);
        this.scheduleNote(v.timbre, v.freq, when, beatsToSeconds(v.durBeats, score.bpm), v.gain);
      }
      this.nextBarTime += barSeconds;
      this.barIndex += 1;
    }
  }

  private scheduleNote(
    type: OscillatorType,
    freq: number,
    when: number,
    dur: number,
    gain: number,
  ): void {
    if (this.ctx === null || this.musicGainNode === null) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const sustainEnd = when + Math.max(0.01, dur - 0.05);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.01);
    g.gain.setValueAtTime(gain, sustainEnd);
    g.gain.linearRampToValueAtTime(0, when + dur);
    osc.connect(g);
    g.connect(this.musicGainNode);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  // TODO(9.6 Task 3): renderiza só a 1ª camada; a casca multi-camada completa (buses, ruído,
  // detune) vem na reescrita de `WebAudioEngine` da Task 3.
  playSfx(id: SfxId, gain: number): void {
    const ctx = this.ensureCtx();
    void ctx.resume();
    const spec = SFX_CATALOG[id];
    const layer = spec.layers[0];
    if (layer === undefined) return;
    const now = ctx.currentTime + layer.delaySec;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const isOscType =
      layer.timbre !== 'noise' &&
      layer.timbre !== 'kick' &&
      layer.timbre !== 'snare' &&
      layer.timbre !== 'hat';
    osc.type = isOscType ? layer.timbre : 'sine';
    osc.frequency.value = layer.freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(Math.max(gain * layer.gain, 0.0001), now + layer.attackSec);
    g.gain.exponentialRampToValueAtTime(0.0001, now + layer.attackSec + layer.decaySec);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + layer.attackSec + layer.decaySec + 0.02);
  }
}
