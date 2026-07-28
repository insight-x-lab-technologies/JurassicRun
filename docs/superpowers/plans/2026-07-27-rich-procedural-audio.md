# 9.6 Áudio procedural rico — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` para
> executar tarefa a tarefa. Passos usam checkbox (`- [ ]`).

**Goal:** trocar o placeholder de áudio (1 oscilador + 1 SFX) por música multi-camada por
contexto/tema, 9 SFX de evento e um seam para faixas de arquivo (Suno).

**Architecture:** puro × casca. `music.ts`/`sfx.ts`/`musicSource.ts` são dados+funções puras
testáveis; `engine.ts` é a única casca WebAudio; `src/render/audioEvents.ts` é um detector puro de
eventos por diff de `WorldState` que o `GameScene` encaminha ao `audioService`.

**Tech Stack:** TypeScript estrito, Vitest, WebAudio API, `@preact/signals`, Phaser (só na casca).

## Global Constraints

- **`src/core/` NÃO é tocado.** Determinismo permanece em 67 testes. Nenhum arquivo sob
  `src/core/` aparece em nenhuma task.
- **Sem alocação por frame no hot path** (REGRA 3): funções que rodam por frame escrevem em
  arrays-scratch recebidos por parâmetro.
- **Sem `Math.random`** em nenhum módulo novo: variação musical vem de LCG puro semeado por
  `(scoreId, barIndex)`; SFX variam por contador de reprodução.
- **Sem string visível ao usuário** (REGRA 4): este item não adiciona nenhuma string de UI.
- **TypeScript estrito, sem `any`.** `noUncheckedIndexedAccess` está ligado ⇒ acesso a índice
  precisa de `!` ou guarda.
- Imports usam os aliases do projeto: `@services/...`, `@core/...`, `@app/...`.
- Testes ficam em `tests/<espelho do src>/`, sufixo `.test.ts`.
- Rodar `npx vitest run <arquivo>` para um teste específico; `npm test` para a suíte;
  `npm run check` para lint+typecheck.

---

### Task 1: `music.ts` — modelo de composição puro

**Files:**
- Create: `src/services/audio/music.ts`
- Create: `tests/services/audio/music.test.ts`
- Modify: `src/services/audio/tracks.ts` (só remove `MUSIC_TRACKS`/`TrackSpec`/`NoteStep`; mantém
  `MusicTrack`, `SfxId` e `beatsToSeconds` por enquanto)
- Modify: `tests/services/audio/tracks.test.ts` (apaga as asserções sobre `MUSIC_TRACKS`, mantém
  as de `beatsToSeconds`)
- Modify: `src/services/audio/engine.ts` (só o suficiente para compilar: o scheduler antigo passa
  a usar `MUSIC_SCORES[...]` — a reescrita completa da casca é a Task 3)

**Interfaces:**
- Consumes: `MusicTrack` de `./tracks`.
- Produces:
  ```ts
  export type MusicTheme = 'classic' | 'volcano' | 'glacier';
  export type LayerId = 'bass' | 'drums' | 'melody' | 'pad';
  export type Timbre = OscillatorType | 'kick' | 'snare' | 'hat';
  export interface LayerSpec { readonly timbre: Timbre; readonly gain: number;
    readonly octave: number; readonly pattern: readonly number[]; readonly durBeats: number;
    readonly degrees?: readonly number[]; }
  export interface MusicScore { readonly id: string; readonly bpm: number;
    readonly beatsPerBar: number; readonly bars: number; readonly rootMidi: number;
    readonly scale: readonly number[]; readonly progression: readonly number[];
    readonly layers: Readonly<Record<LayerId, LayerSpec>>; }
  export interface Voice { layer: LayerId; timbre: Timbre; freq: number; startBeat: number;
    durBeats: number; gain: number; }
  export function midiToFreq(midi: number): number;
  export function scaleDegreeToMidi(score: MusicScore, degree: number, octave: number): number;
  export function voicesForBar(score: MusicScore, barIndex: number, out: Voice[]): Voice[];
  export const MAX_VOICES_PER_BAR = 48;
  export const MUSIC_SCORES: Readonly<Record<MusicTheme, Readonly<Record<MusicTrack, MusicScore>>>>;
  ```

- [ ] **Step 1: Escrever o teste que falha**

`tests/services/audio/music.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  midiToFreq,
  scaleDegreeToMidi,
  voicesForBar,
  MUSIC_SCORES,
  MAX_VOICES_PER_BAR,
  type Voice,
  type MusicTheme,
} from '@services/audio/music';
import type { MusicTrack } from '@services/audio/tracks';

const THEMES: MusicTheme[] = ['classic', 'volcano', 'glacier'];
const TRACKS: MusicTrack[] = ['menu', 'gameplay'];

describe('midiToFreq', () => {
  it('ancora em A4 = 440 Hz e dobra por oitava', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });
});

describe('scaleDegreeToMidi', () => {
  it('grau 0 = tônica; graus acima do modo sobem de oitava', () => {
    const score = MUSIC_SCORES.classic.menu;
    expect(scaleDegreeToMidi(score, 0, 0)).toBe(score.rootMidi);
    const n = score.scale.length;
    expect(scaleDegreeToMidi(score, n, 0)).toBe(score.rootMidi + 12);
    expect(scaleDegreeToMidi(score, 0, 1)).toBe(score.rootMidi + 12);
  });

  it('graus negativos descem sem quebrar', () => {
    const score = MUSIC_SCORES.classic.menu;
    expect(scaleDegreeToMidi(score, -1, 0)).toBeLessThan(score.rootMidi);
  });
});

describe('MUSIC_SCORES', () => {
  it('cobre os 3 temas × 2 contextos com dados válidos', () => {
    for (const theme of THEMES) {
      for (const track of TRACKS) {
        const s = MUSIC_SCORES[theme][track];
        expect(s.id).toBe(`${theme}.${track}`);
        expect(s.bpm).toBeGreaterThan(40);
        expect(s.bpm).toBeLessThan(200);
        expect(s.beatsPerBar).toBeGreaterThan(0);
        expect(s.bars).toBeGreaterThan(1);
        expect(s.scale.length).toBeGreaterThanOrEqual(5);
        expect(s.progression.length).toBe(s.bars);
        for (const layer of ['bass', 'drums', 'melody', 'pad'] as const) {
          const l = s.layers[layer];
          expect(l.gain).toBeGreaterThan(0);
          expect(l.gain).toBeLessThanOrEqual(1);
          expect(l.pattern.length).toBeGreaterThan(0);
          for (const beat of l.pattern) {
            expect(beat).toBeGreaterThanOrEqual(0);
            expect(beat).toBeLessThan(s.beatsPerBar);
          }
        }
      }
    }
  });

  it('gameplay é mais rápido que menu em todos os temas', () => {
    for (const theme of THEMES) {
      expect(MUSIC_SCORES[theme].gameplay.bpm).toBeGreaterThan(MUSIC_SCORES[theme].menu.bpm);
    }
  });

  it('os temas soam diferentes (tônica ou modo distintos no gameplay)', () => {
    const fingerprint = (t: MusicTheme): string =>
      `${MUSIC_SCORES[t].gameplay.rootMidi}:${MUSIC_SCORES[t].gameplay.scale.join(',')}`;
    const all = THEMES.map(fingerprint);
    expect(new Set(all).size).toBe(THEMES.length);
  });
});

describe('voicesForBar', () => {
  it('é determinístico: a mesma barra gera as mesmas vozes', () => {
    const score = MUSIC_SCORES.classic.gameplay;
    const a: Voice[] = [];
    const b: Voice[] = [];
    voicesForBar(score, 3, a);
    voicesForBar(score, 3, b);
    expect(b).toEqual(a);
  });

  it('barras diferentes variam a melodia', () => {
    const score = MUSIC_SCORES.classic.gameplay;
    const melodyOf = (bar: number): number[] => {
      const out: Voice[] = [];
      voicesForBar(score, bar, out);
      return out.filter((v) => v.layer === 'melody').map((v) => v.freq);
    };
    const bars = [0, 1, 2, 3, 4, 5, 6, 7].map(melodyOf);
    const distinct = new Set(bars.map((b) => b.join(',')));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('o loop fecha: a barra N e a barra N + bars são idênticas', () => {
    const score = MUSIC_SCORES.classic.gameplay;
    const a: Voice[] = [];
    const b: Voice[] = [];
    voicesForBar(score, 2, a);
    voicesForBar(score, 2 + score.bars, b);
    expect(b).toEqual(a);
  });

  it('reusa o array de saída (sem alocação por compasso)', () => {
    const score = MUSIC_SCORES.volcano.gameplay;
    const out: Voice[] = [];
    const returned = voicesForBar(score, 0, out);
    expect(returned).toBe(out);
    const firstObject = out[0];
    voicesForBar(score, 1, out);
    expect(out[0]).toBe(firstObject); // objetos de voz reciclados, não recriados
  });

  it('todas as vozes cabem no compasso e respeitam o teto', () => {
    for (const theme of THEMES) {
      for (const track of TRACKS) {
        const score = MUSIC_SCORES[theme][track];
        const out: Voice[] = [];
        for (let bar = 0; bar < score.bars; bar += 1) {
          voicesForBar(score, bar, out);
          expect(out.length).toBeLessThanOrEqual(MAX_VOICES_PER_BAR);
          for (const v of out) {
            expect(v.startBeat).toBeGreaterThanOrEqual(0);
            expect(v.startBeat).toBeLessThan(score.beatsPerBar);
            expect(v.durBeats).toBeGreaterThan(0);
            expect(v.gain).toBeGreaterThan(0);
            if (v.timbre === 'kick' || v.timbre === 'snare' || v.timbre === 'hat') continue;
            expect(v.freq).toBeGreaterThan(20);
            expect(v.freq).toBeLessThan(5000);
          }
        }
      }
    }
  });

  it('todas as 4 camadas aparecem ao longo do loop', () => {
    const score = MUSIC_SCORES.glacier.gameplay;
    const seen = new Set<string>();
    const out: Voice[] = [];
    for (let bar = 0; bar < score.bars; bar += 1) {
      voicesForBar(score, bar, out);
      for (const v of out) seen.add(v.layer);
    }
    expect(seen).toEqual(new Set(['bass', 'drums', 'melody', 'pad']));
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/services/audio/music.test.ts`
Expected: FAIL — `Cannot find module '@services/audio/music'`.

- [ ] **Step 3: Implementar `src/services/audio/music.ts`**

```ts
// Módulo PURO (sem WebAudio/DOM): modelo de composição multi-camada + geração de vozes por
// compasso. A casca (`engine.ts`) só traduz `Voice` em nós WebAudio.
// Sem `Math.random`: a variação é um LCG semeado por (id da partitura, índice do compasso) ⇒
// mesma barra ⇒ mesmas notas ⇒ testável e sem deriva entre reproduções.
import type { MusicTrack } from './tracks';

export type MusicTheme = 'classic' | 'volcano' | 'glacier';
export type LayerId = 'bass' | 'drums' | 'melody' | 'pad';
/** Timbres percussivos (`kick`/`snare`/`hat`) ignoram `freq`: a casca os sintetiza com ruído. */
export type Timbre = OscillatorType | 'kick' | 'snare' | 'hat';

export interface LayerSpec {
  readonly timbre: Timbre;
  /** Ganho relativo dentro da faixa (0..1). */
  readonly gain: number;
  /** Deslocamento em oitavas a partir de `rootMidi`. */
  readonly octave: number;
  /** Offsets em BEATS dentro do compasso onde a camada ataca. */
  readonly pattern: readonly number[];
  /** Duração de cada ataque, em beats. */
  readonly durBeats: number;
  /** Graus da escala sorteáveis (só melodia/pad). Ausente ⇒ usa o grau do compasso. */
  readonly degrees?: readonly number[];
}

export interface MusicScore {
  readonly id: string;
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly bars: number;
  readonly rootMidi: number;
  /** Semitons do modo, começando em 0. */
  readonly scale: readonly number[];
  /** Grau da escala que rege cada compasso do loop. */
  readonly progression: readonly number[];
  readonly layers: Readonly<Record<LayerId, LayerSpec>>;
}

/** Uma nota agendável. MUTÁVEL de propósito: reciclada no array-scratch (REGRA 3). */
export interface Voice {
  layer: LayerId;
  timbre: Timbre;
  freq: number;
  startBeat: number;
  durBeats: number;
  gain: number;
}

/** Teto de segurança: um compasso nunca agenda mais que isto (custo de CPU do WebAudio). */
export const MAX_VOICES_PER_BAR = 48;

const LAYER_ORDER: readonly LayerId[] = ['bass', 'drums', 'pad', 'melody'];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Grau (pode passar do fim do modo ou ser negativo) + oitava ⇒ nota MIDI. */
export function scaleDegreeToMidi(score: MusicScore, degree: number, octave: number): number {
  const n = score.scale.length;
  const octaveShift = Math.floor(degree / n);
  const index = degree - octaveShift * n; // sempre 0..n-1 (Math.floor trata negativo)
  const semitone = score.scale[index] ?? 0;
  return score.rootMidi + semitone + 12 * (octave + octaveShift);
}

/** Hash estável de string (FNV-1a 32 bits) — semente do LCG de variação. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** LCG de 32 bits (numerical recipes). Puro: o chamador carrega o estado. */
function nextRandom(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

/** Empurra uma voz reciclando o objeto do índice `i` (sem alocar quando o array já cresceu). */
function writeVoice(
  out: Voice[],
  i: number,
  layer: LayerId,
  timbre: Timbre,
  freq: number,
  startBeat: number,
  durBeats: number,
  gain: number,
): void {
  const existing = out[i];
  if (existing === undefined) {
    out.push({ layer, timbre, freq, startBeat, durBeats, gain });
    return;
  }
  existing.layer = layer;
  existing.timbre = timbre;
  existing.freq = freq;
  existing.startBeat = startBeat;
  existing.durBeats = durBeats;
  existing.gain = gain;
}

/**
 * Vozes de UM compasso do loop. `barIndex` é absoluto; o compasso efetivo é
 * `barIndex % score.bars` ⇒ o loop fecha e a variação se repete a cada volta.
 * Escreve em `out` (reciclando objetos) e devolve o próprio `out`.
 */
export function voicesForBar(score: MusicScore, barIndex: number, out: Voice[]): Voice[] {
  const bar = ((barIndex % score.bars) + score.bars) % score.bars;
  const chordDegree = score.progression[bar] ?? 0;
  let rng = nextRandom(hashId(score.id) ^ (bar * 2654435761));
  let i = 0;

  for (const layerId of LAYER_ORDER) {
    const layer = score.layers[layerId];
    const percussive = layer.timbre === 'kick' || layer.timbre === 'snare' || layer.timbre === 'hat';
    for (const beat of layer.pattern) {
      if (i >= MAX_VOICES_PER_BAR) break;
      let freq = 0;
      if (!percussive) {
        let degree = chordDegree;
        const choices = layer.degrees;
        if (choices !== undefined && choices.length > 0) {
          rng = nextRandom(rng);
          const pick = choices[rng % choices.length] ?? 0;
          degree = chordDegree + pick;
        }
        freq = midiToFreq(scaleDegreeToMidi(score, degree, layer.octave));
      }
      const dur = Math.min(layer.durBeats, score.beatsPerBar - beat);
      writeVoice(out, i, layerId, layer.timbre, freq, beat, dur, layer.gain);
      i += 1;
    }
  }
  out.length = i;
  return out;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
const LYDIAN = [0, 2, 4, 6, 7, 9, 11] as const;

/**
 * As 6 partituras. Menu = lento, esparso, pad longo. Gameplay = rápido, ostinato de baixo,
 * kick/hat constantes, melodia densa. Tema muda tônica, modo e timbres.
 */
export const MUSIC_SCORES: Readonly<Record<MusicTheme, Readonly<Record<MusicTrack, MusicScore>>>> =
  Object.freeze({
    classic: Object.freeze({
      menu: Object.freeze({
        id: 'classic.menu',
        bpm: 78,
        beatsPerBar: 4,
        bars: 8,
        rootMidi: 45, // A2
        scale: MAJOR,
        progression: [0, 0, 5, 5, 3, 3, 4, 4],
        layers: Object.freeze({
          bass: { timbre: 'sine' as const, gain: 0.55, octave: 0, pattern: [0, 2], durBeats: 1.8 },
          drums: { timbre: 'hat' as const, gain: 0.16, octave: 0, pattern: [0, 2], durBeats: 0.2 },
          pad: { timbre: 'triangle' as const, gain: 0.28, octave: 2, pattern: [0], durBeats: 4 },
          melody: {
            timbre: 'triangle' as const, gain: 0.3, octave: 3,
            pattern: [1, 2.5, 3.5], durBeats: 0.9, degrees: [0, 2, 4, 6, -3],
          },
        }),
      }),
      gameplay: Object.freeze({
        id: 'classic.gameplay',
        bpm: 132,
        beatsPerBar: 4,
        bars: 8,
        rootMidi: 45,
        scale: MAJOR,
        progression: [0, 0, 3, 3, 5, 5, 4, 4],
        layers: Object.freeze({
          bass: {
            timbre: 'sawtooth' as const, gain: 0.4, octave: 0,
            pattern: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], durBeats: 0.45,
          },
          drums: {
            timbre: 'kick' as const, gain: 0.5, octave: 0,
            pattern: [0, 1, 2, 2.5, 3], durBeats: 0.25,
          },
          pad: { timbre: 'triangle' as const, gain: 0.18, octave: 2, pattern: [0], durBeats: 4 },
          melody: {
            timbre: 'square' as const, gain: 0.22, octave: 3,
            pattern: [0, 0.75, 1.5, 2.25, 3, 3.5], durBeats: 0.5,
            degrees: [0, 2, 4, 5, 7, -2],
          },
        }),
      }),
    }),
    volcano: Object.freeze({
      menu: Object.freeze({
        id: 'volcano.menu',
        bpm: 70,
        beatsPerBar: 4,
        bars: 8,
        rootMidi: 41, // F2
        scale: MINOR,
        progression: [0, 0, 2, 2, 5, 5, 4, 4],
        layers: Object.freeze({
          bass: { timbre: 'sawtooth' as const, gain: 0.5, octave: 0, pattern: [0], durBeats: 3.6 },
          drums: { timbre: 'kick' as const, gain: 0.42, octave: 0, pattern: [0, 2.5], durBeats: 0.3 },
          pad: { timbre: 'sine' as const, gain: 0.3, octave: 2, pattern: [0], durBeats: 4 },
          melody: {
            timbre: 'triangle' as const, gain: 0.24, octave: 3,
            pattern: [1.5, 3], durBeats: 1.2, degrees: [0, 3, 4, -1],
          },
        }),
      }),
      gameplay: Object.freeze({
        id: 'volcano.gameplay',
        bpm: 142,
        beatsPerBar: 4,
        bars: 8,
        rootMidi: 41,
        scale: MINOR,
        progression: [0, 0, 4, 4, 2, 2, 6, 6],
        layers: Object.freeze({
          bass: {
            timbre: 'sawtooth' as const, gain: 0.45, octave: 0,
            pattern: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], durBeats: 0.4,
          },
          drums: {
            timbre: 'kick' as const, gain: 0.55, octave: 0,
            pattern: [0, 0.75, 1.5, 2, 3, 3.5], durBeats: 0.22,
          },
          pad: { timbre: 'sawtooth' as const, gain: 0.14, octave: 1, pattern: [0], durBeats: 4 },
          melody: {
            timbre: 'square' as const, gain: 0.2, octave: 3,
            pattern: [0.5, 1.25, 2.5, 3.25], durBeats: 0.5, degrees: [0, 3, 5, 7, -2],
          },
        }),
      }),
    }),
    glacier: Object.freeze({
      menu: Object.freeze({
        id: 'glacier.menu',
        bpm: 68,
        beatsPerBar: 4,
        bars: 8,
        rootMidi: 48, // C3
        scale: LYDIAN,
        progression: [0, 0, 4, 4, 2, 2, 5, 5],
        layers: Object.freeze({
          bass: { timbre: 'sine' as const, gain: 0.45, octave: -1, pattern: [0], durBeats: 3.8 },
          drums: { timbre: 'hat' as const, gain: 0.12, octave: 0, pattern: [1, 3], durBeats: 0.18 },
          pad: { timbre: 'sine' as const, gain: 0.32, octave: 1, pattern: [0], durBeats: 4 },
          melody: {
            timbre: 'sine' as const, gain: 0.3, octave: 3,
            pattern: [0.5, 2, 3.25], durBeats: 1, degrees: [0, 2, 4, 6],
          },
        }),
      }),
      gameplay: Object.freeze({
        id: 'glacier.gameplay',
        bpm: 128,
        beatsPerBar: 4,
        bars: 8,
        rootMidi: 48,
        scale: LYDIAN,
        progression: [0, 0, 5, 5, 3, 3, 4, 4],
        layers: Object.freeze({
          bass: {
            timbre: 'triangle' as const, gain: 0.42, octave: -1,
            pattern: [0, 1, 1.5, 2, 3, 3.5], durBeats: 0.5,
          },
          drums: {
            timbre: 'hat' as const, gain: 0.2, octave: 0,
            pattern: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], durBeats: 0.15,
          },
          pad: { timbre: 'sine' as const, gain: 0.2, octave: 2, pattern: [0], durBeats: 4 },
          melody: {
            timbre: 'triangle' as const, gain: 0.26, octave: 3,
            pattern: [0, 0.5, 1.5, 2.5, 3], durBeats: 0.45, degrees: [0, 2, 4, 6, 7],
          },
        }),
      }),
    }),
  });
```

- [ ] **Step 4: Podar `tracks.ts` e o teste dele**

Em `src/services/audio/tracks.ts`, APAGAR `NoteStep`, `TrackSpec` e `MUSIC_TRACKS`. O arquivo
fica com:

```ts
export type MusicTrack = 'menu' | 'gameplay';

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}
```

(`SfxId`/`SfxSpec`/`SFX_CATALOG` saem na Task 2 — deixe-os aqui por enquanto para não quebrar o
build.) Em `tests/services/audio/tracks.test.ts`, apagar as asserções que citam `MUSIC_TRACKS` e
manter as de `beatsToSeconds`/`SFX_CATALOG`.

- [ ] **Step 5: Fazer `engine.ts` compilar contra o modelo novo**

No `engine.ts`, trocar o scheduler de notas por um scheduler de compasso mínimo (a casca completa
vem na Task 3). Substituir o import de `MUSIC_TRACKS` por `MUSIC_SCORES`/`voicesForBar` e trocar
`scheduler()` por:

```ts
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
```

Campos: trocar `nextNoteTime`/`stepIndex` por `nextBarTime = 0` / `barIndex = 0` e adicionar
`private readonly voiceScratch: Voice[] = [];`. `scheduleNote` ganha o parâmetro `gain: number` e
multiplica a rampa de envelope por ele. Em `playMusic`, inicializar
`this.nextBarTime = ctx.currentTime + 0.05; this.barIndex = 0;`.

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run tests/services/audio/ && npm run check`
Expected: PASS, typecheck limpo.

- [ ] **Step 7: Commit**

```bash
git add src/services/audio/music.ts src/services/audio/tracks.ts src/services/audio/engine.ts \
        tests/services/audio/music.test.ts tests/services/audio/tracks.test.ts
git commit -m "feat(9.6): modelo de composição multi-camada puro (music.ts)"
```

---

### Task 2: `sfx.ts` — catálogo de SFX multi-camada puro

**Files:**
- Create: `src/services/audio/sfx.ts`
- Create: `tests/services/audio/sfx.test.ts`
- Modify: `src/services/audio/tracks.ts` (remove `SfxId`, `SfxSpec`, `SFX_CATALOG`)
- Modify: `tests/services/audio/tracks.test.ts` (remove o que citava `SFX_CATALOG`)
- Modify: `src/services/audio/engine.ts`, `src/services/audio/index.ts` (importar `SfxId` de
  `./sfx`; `playSfx` ainda pode renderizar só a 1ª camada — a casca completa é a Task 3)
- Modify: `tests/services/audio/engine.test.ts`, `tests/services/audio/service.test.ts` (ajustar
  o import de `SfxId` se aparecer)

**Interfaces:**
- Consumes: `Timbre` de `./music`.
- Produces:
  ```ts
  export type SfxId = 'click' | 'flap' | 'coin' | 'powerup' | 'hit'
    | 'gameOver' | 'nearMiss' | 'levelUp' | 'block';
  export interface SfxLayer { readonly timbre: Timbre | 'noise'; readonly freq: number;
    readonly freqEnd?: number; readonly delaySec: number; readonly attackSec: number;
    readonly decaySec: number; readonly gain: number; readonly filterHz?: number; }
  export interface SfxSpec { readonly layers: readonly SfxLayer[]; }
  export const SFX_CATALOG: Readonly<Record<SfxId, SfxSpec>>;
  export const SFX_IDS: readonly SfxId[];
  export function sfxDurationSec(spec: SfxSpec): number;
  export function sfxDetune(id: SfxId, playCount: number): number;
  ```

- [ ] **Step 1: Escrever o teste que falha**

`tests/services/audio/sfx.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SFX_CATALOG, SFX_IDS, sfxDurationSec, sfxDetune } from '@services/audio/sfx';

describe('SFX_CATALOG', () => {
  it('cobre os 9 eventos', () => {
    expect([...SFX_IDS].sort()).toEqual(
      ['block', 'click', 'coin', 'flap', 'gameOver', 'hit', 'levelUp', 'nearMiss', 'powerup'],
    );
    for (const id of SFX_IDS) expect(SFX_CATALOG[id]).toBeDefined();
  });

  it('camadas têm envelope e ganho sãos', () => {
    for (const id of SFX_IDS) {
      const spec = SFX_CATALOG[id];
      expect(spec.layers.length).toBeGreaterThan(0);
      for (const l of spec.layers) {
        expect(l.gain).toBeGreaterThan(0);
        expect(l.gain).toBeLessThanOrEqual(1);
        expect(l.attackSec).toBeGreaterThan(0);
        expect(l.decaySec).toBeGreaterThan(0);
        expect(l.delaySec).toBeGreaterThanOrEqual(0);
        expect(l.freq).toBeGreaterThan(0);
        if (l.freqEnd !== undefined) expect(l.freqEnd).toBeGreaterThan(0);
        if (l.filterHz !== undefined) expect(l.filterHz).toBeGreaterThan(0);
      }
    }
  });

  it('nenhum SFX passa de 1,5 s (não atropela o gameplay)', () => {
    for (const id of SFX_IDS) {
      const d = sfxDurationSec(SFX_CATALOG[id]);
      expect(d).toBeGreaterThan(0.02);
      expect(d).toBeLessThanOrEqual(1.5);
    }
  });

  it('o flap é curto o bastante para taps rápidos', () => {
    expect(sfxDurationSec(SFX_CATALOG.flap)).toBeLessThan(0.35);
  });

  it('a soma dos ganhos por instante não estoura (headroom)', () => {
    for (const id of SFX_IDS) {
      const total = SFX_CATALOG[id].layers.reduce((s, l) => s + l.gain, 0);
      expect(total).toBeLessThanOrEqual(2);
    }
  });
});

describe('sfxDetune', () => {
  it('é determinístico e limitado a ±1 semitom', () => {
    for (let n = 0; n < 50; n += 1) {
      const a = sfxDetune('flap', n);
      expect(a).toBe(sfxDetune('flap', n));
      expect(Math.abs(a)).toBeLessThanOrEqual(100);
    }
  });

  it('varia entre reproduções consecutivas', () => {
    const values = new Set([0, 1, 2, 3, 4, 5].map((n) => sfxDetune('flap', n)));
    expect(values.size).toBeGreaterThan(1);
  });

  it('o clique não varia (feedback de UI estável)', () => {
    expect(sfxDetune('click', 0)).toBe(0);
    expect(sfxDetune('click', 7)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/services/audio/sfx.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/services/audio/sfx.ts`**

```ts
// Módulo PURO (sem WebAudio): catálogo de efeitos sonoros multi-camada. Cada SFX é uma pilha de
// parciais (oscilador com glide opcional, ou ruído filtrado) com envelope AD próprio e offset.
// A casca (`engine.ts`) traduz cada camada em nós WebAudio.
import type { Timbre } from './music';

export type SfxId =
  | 'click'
  | 'flap'
  | 'coin'
  | 'powerup'
  | 'hit'
  | 'gameOver'
  | 'nearMiss'
  | 'levelUp'
  | 'block';

export interface SfxLayer {
  /** `'noise'` = ruído branco filtrado; o resto são osciladores. */
  readonly timbre: Timbre | 'noise';
  readonly freq: number;
  /** Glide exponencial até esta frequência ao longo de attack+decay. */
  readonly freqEnd?: number;
  readonly delaySec: number;
  readonly attackSec: number;
  readonly decaySec: number;
  readonly gain: number;
  /** Corte do lowpass (só faz sentido em `noise`). */
  readonly filterHz?: number;
}

export interface SfxSpec {
  readonly layers: readonly SfxLayer[];
}

/** Duração total: fim da camada que termina mais tarde. */
export function sfxDurationSec(spec: SfxSpec): number {
  let end = 0;
  for (const l of spec.layers) {
    const layerEnd = l.delaySec + l.attackSec + l.decaySec;
    if (layerEnd > end) end = layerEnd;
  }
  return end;
}

/** Ids que variam de afinação a cada repetição (evita metralhadora). Clique fica fixo. */
const DETUNED: ReadonlySet<SfxId> = new Set<SfxId>(['flap', 'coin', 'nearMiss']);
/** Padrão de detune em cents, percorrido ciclicamente — determinístico, sem RNG. */
const DETUNE_CENTS: readonly number[] = [0, 35, -25, 60, -50, 15];

export function sfxDetune(id: SfxId, playCount: number): number {
  if (!DETUNED.has(id)) return 0;
  const n = DETUNE_CENTS.length;
  const idx = ((playCount % n) + n) % n;
  return DETUNE_CENTS[idx] ?? 0;
}

export const SFX_CATALOG: Readonly<Record<SfxId, SfxSpec>> = Object.freeze({
  // Clique de UI: tom curto e suave (o placeholder do 4.10 era `square` seco).
  click: Object.freeze({
    layers: [
      { timbre: 'triangle', freq: 880, delaySec: 0, attackSec: 0.004, decaySec: 0.06, gain: 0.5 },
      { timbre: 'sine', freq: 1320, delaySec: 0.01, attackSec: 0.004, decaySec: 0.04, gain: 0.2 },
    ],
  }),
  // Bater de asa: whoosh de ruído + corpo grave descendente.
  flap: Object.freeze({
    layers: [
      { timbre: 'noise', freq: 1, delaySec: 0, attackSec: 0.01, decaySec: 0.13, gain: 0.35, filterHz: 1400 },
      { timbre: 'sine', freq: 260, freqEnd: 150, delaySec: 0, attackSec: 0.008, decaySec: 0.12, gain: 0.25 },
    ],
  }),
  // Moeda: arpejo ascendente de quinta, brilhante.
  coin: Object.freeze({
    layers: [
      { timbre: 'square', freq: 988, delaySec: 0, attackSec: 0.004, decaySec: 0.07, gain: 0.28 },
      { timbre: 'square', freq: 1319, delaySec: 0.06, attackSec: 0.004, decaySec: 0.16, gain: 0.24 },
    ],
  }),
  // Power-up: tríade ascendente com sweep — "algo bom aconteceu".
  powerup: Object.freeze({
    layers: [
      { timbre: 'triangle', freq: 523, delaySec: 0, attackSec: 0.01, decaySec: 0.12, gain: 0.3 },
      { timbre: 'triangle', freq: 659, delaySec: 0.08, attackSec: 0.01, decaySec: 0.12, gain: 0.3 },
      { timbre: 'triangle', freq: 784, freqEnd: 1568, delaySec: 0.16, attackSec: 0.01, decaySec: 0.3, gain: 0.26 },
    ],
  }),
  // Colisão: impacto de ruído grave + queda de sawtooth.
  hit: Object.freeze({
    layers: [
      { timbre: 'noise', freq: 1, delaySec: 0, attackSec: 0.003, decaySec: 0.26, gain: 0.45, filterHz: 500 },
      { timbre: 'sawtooth', freq: 180, freqEnd: 55, delaySec: 0, attackSec: 0.005, decaySec: 0.35, gain: 0.4 },
    ],
  }),
  // Game over: motivo descendente de 3 notas.
  gameOver: Object.freeze({
    layers: [
      { timbre: 'triangle', freq: 392, delaySec: 0, attackSec: 0.015, decaySec: 0.3, gain: 0.32 },
      { timbre: 'triangle', freq: 311, delaySec: 0.22, attackSec: 0.015, decaySec: 0.3, gain: 0.32 },
      { timbre: 'triangle', freq: 233, delaySec: 0.44, attackSec: 0.02, decaySec: 0.6, gain: 0.34 },
    ],
  }),
  // Near-miss: sopro curto e discreto (é frequente — precisa ser barato de ouvir).
  nearMiss: Object.freeze({
    layers: [
      { timbre: 'noise', freq: 1, delaySec: 0, attackSec: 0.02, decaySec: 0.14, gain: 0.18, filterHz: 2600 },
    ],
  }),
  // Level-up: arpejo ascendente de 4 notas.
  levelUp: Object.freeze({
    layers: [
      { timbre: 'square', freq: 523, delaySec: 0, attackSec: 0.006, decaySec: 0.1, gain: 0.2 },
      { timbre: 'square', freq: 659, delaySec: 0.07, attackSec: 0.006, decaySec: 0.1, gain: 0.2 },
      { timbre: 'square', freq: 784, delaySec: 0.14, attackSec: 0.006, decaySec: 0.1, gain: 0.2 },
      { timbre: 'square', freq: 1047, delaySec: 0.21, attackSec: 0.006, decaySec: 0.28, gain: 0.22 },
    ],
  }),
  // Escudo/vida extra absorvendo o golpe: ping metálico.
  block: Object.freeze({
    layers: [
      { timbre: 'sine', freq: 1200, freqEnd: 700, delaySec: 0, attackSec: 0.004, decaySec: 0.22, gain: 0.3 },
      { timbre: 'noise', freq: 1, delaySec: 0, attackSec: 0.003, decaySec: 0.09, gain: 0.2, filterHz: 3500 },
    ],
  }),
});

export const SFX_IDS: readonly SfxId[] = Object.freeze(Object.keys(SFX_CATALOG) as SfxId[]);
```

- [ ] **Step 4: Limpar `tracks.ts` e religar os imports**

`src/services/audio/tracks.ts` fica só com `MusicTrack` + `beatsToSeconds`. Trocar os imports de
`SfxId`/`SFX_CATALOG` em `engine.ts` e `index.ts` para `./sfx`. Em `index.ts`, o reexport
`export type { AudioEngine } from './engine';` continua; adicionar
`export type { SfxId } from './sfx';`. Ajustar `tests/services/audio/tracks.test.ts`,
`engine.test.ts` e `service.test.ts` se importarem de `./tracks`.

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/services/audio/ && npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/audio/ tests/services/audio/
git commit -m "feat(9.6): catálogo de SFX multi-camada (9 eventos)"
```

---

### Task 3: casca WebAudio — buses, ruído, scheduler de compasso, renderer de SFX

**Files:**
- Modify: `src/services/audio/engine.ts` (reescrita da classe `WebAudioEngine`)
- Modify: `tests/services/audio/engine.test.ts` (cobre só o `nullAudioEngine`; estender com o
  novo parâmetro de tema)

**Interfaces:**
- Consumes: `MUSIC_SCORES`, `voicesForBar`, `Voice`, `MusicTheme` (Task 1); `SFX_CATALOG`,
  `sfxDetune`, `SfxId` (Task 2); `beatsToSeconds` (`./tracks`).
- Produces (assinatura NOVA do seam — os consumidores mudam na Task 5):
  ```ts
  export interface AudioEngine {
    resume(): Promise<void>;
    playSfx(id: SfxId, gain: number): void;
    playMusic(track: MusicTrack, gain: number, theme: MusicTheme): void;
    stopMusic(): void;
    setMusicGain(gain: number): void;
    readonly running: MusicTrack | null;
    readonly runningTheme: MusicTheme | null;
  }
  export interface RecordingAudioEngine extends AudioEngine {
    readonly musicStarts: MusicTrack[];
    readonly themeStarts: MusicTheme[];
    readonly sfxPlayed: SfxId[];
    stops: number; lastMusicGain: number; resumed: boolean;
  }
  ```

- [ ] **Step 1: Estender o teste do engine de gravação**

Acrescentar a `tests/services/audio/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nullAudioEngine } from '@services/audio/engine';

describe('nullAudioEngine — tema', () => {
  it('registra o tema junto com a faixa', () => {
    const e = nullAudioEngine();
    e.playMusic('menu', 0.3, 'volcano');
    expect(e.running).toBe('menu');
    expect(e.runningTheme).toBe('volcano');
    expect(e.themeStarts).toEqual(['volcano']);
    e.stopMusic();
    expect(e.running).toBeNull();
    expect(e.runningTheme).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/services/audio/engine.test.ts`
Expected: FAIL — `playMusic` aceita 2 args / `runningTheme` não existe.

- [ ] **Step 3: Reescrever `engine.ts`**

Trocar a interface e o `nullAudioEngine` pela forma acima (adicionar `themeStarts: MusicTheme[]`,
`runningTheme` derivado, limpo no `stopMusic`). A `WebAudioEngine` passa a ser:

```ts
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.35; // ≥ 1 compasso de folga p/ agendar por compasso
const NOISE_BUFFER_SEC = 2;

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

  get running(): MusicTrack | null { return this._running; }
  get runningTheme(): MusicTheme | null { return this._theme; }

  private ensureCtx(): AudioContext {
    if (this.ctx === null) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.musicBus = ctx.createGain();
      this.musicBus.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(ctx.destination);
      // Ruído branco cacheado (kick/snare/hat/whooshes reusam este buffer).
      const frames = Math.floor(ctx.sampleRate * NOISE_BUFFER_SEC);
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buf.getChannelData(0);
      // LCG (sem Math.random): ruído idêntico a cada carga, reprodutível.
      let s = 22222;
      for (let i = 0; i < frames; i += 1) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        data[i] = (s / 0x7fffffff) - 1;
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
    this._running = track;
    this._theme = theme;
    if (this.musicBus !== null) this.musicBus.gain.value = gain;
    this.nextBarTime = ctx.currentTime + 0.08;
    this.barIndex = 0;
    this.timer = setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  stopMusic(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this._running = null;
    this._theme = null;
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
    if (v.timbre === 'kick') { this.scheduleKick(when, v.gain); return; }
    if (v.timbre === 'snare') { this.scheduleNoiseHit(when, v.gain, 1800, 0.18); return; }
    if (v.timbre === 'hat') { this.scheduleNoiseHit(when, v.gain, 8000, 0.05); return; }
    this.scheduleTone(v.timbre, v.freq, when, dur, v.gain, this.musicBus);
  }
```

Helpers privados a acrescentar (todos com guarda `if (this.ctx === null …) return;`):

```ts
  /** Tom com envelope AD e glide opcional; `bus` = musicBus ou sfxBus. */
  private scheduleTone(
    type: OscillatorType, freq: number, when: number, dur: number, gain: number,
    bus: GainNode | null, freqEnd?: number, detuneCents = 0,
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
    when: number, gain: number, filterHz: number, dur: number, bus: GainNode | null = this.musicBus,
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
    if (this.sfxBus !== null) this.sfxBus.gain.value = 1;
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
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/services/audio/ && npm run check`
Expected: PASS (o `service.test.ts` pode falhar no `playMusic` de 3 args — corrigir os call-sites
de teste passando `'classic'`).

- [ ] **Step 5: Commit**

```bash
git add src/services/audio/engine.ts tests/services/audio/
git commit -m "feat(9.6): casca WebAudio multi-camada (buses, ruído, scheduler por compasso)"
```

---

### Task 4: tema por expansão na `policy` + fio até o engine

**Files:**
- Modify: `src/services/audio/policy.ts`
- Modify: `src/services/audio/index.ts`
- Modify: `tests/services/audio/policy.test.ts`
- Modify: `tests/services/audio/service.test.ts`

**Interfaces:**
- Consumes: `MusicTheme` (Task 1); `entitlementsService.activeExpansion` de `@services/entitlements`
  (signal de `ExpansionDef` com `.id: string`).
- Produces:
  ```ts
  export function musicThemeFor(expansionId: string): MusicTheme;
  export interface AudioInput { /* ...existentes... */ readonly expansionId: string; }
  export interface AudioTarget { /* ...existentes... */ readonly theme: MusicTheme; }
  ```

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/services/audio/policy.test.ts` (e adicionar `expansionId: 'classic'` ao
objeto `base` existente):

```ts
import { musicThemeFor } from '@services/audio/policy';

describe('musicThemeFor', () => {
  it('mapeia as expansões conhecidas', () => {
    expect(musicThemeFor('classic')).toBe('classic');
    expect(musicThemeFor('volcano')).toBe('volcano');
    expect(musicThemeFor('glacier')).toBe('glacier');
  });

  it('cai em classic para id desconhecido', () => {
    expect(musicThemeFor('nao-existe')).toBe('classic');
    expect(musicThemeFor('')).toBe('classic');
  });
});

describe('resolveAudioTarget — tema', () => {
  it('propaga o tema da expansão ativa', () => {
    expect(resolveAudioTarget({ ...base, expansionId: 'volcano' }).theme).toBe('volcano');
  });

  it('mantém o tema mesmo em silêncio (o consumidor não precisa de fallback)', () => {
    expect(resolveAudioTarget({ ...base, volume: 0, expansionId: 'glacier' }).theme).toBe('glacier');
  });
});
```

E em `tests/services/audio/service.test.ts`, um teste de troca ao vivo:

```ts
it('trocar de expansão troca a faixa (tema novo)', () => {
  // Padrão do arquivo: init(engine de gravação) + mexer nos signals + checar musicStarts/themeStarts.
  // Após a troca de expansão com a mesma rota, o engine deve reiniciar a música no tema novo.
});
```
(o implementador escreve o corpo seguindo o padrão já usado no arquivo para trocar signals; a
asserção é `engine.themeStarts` terminar em `'volcano'` e `engine.musicStarts.length` ter crescido.)

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/services/audio/policy.test.ts tests/services/audio/service.test.ts`
Expected: FAIL — `musicThemeFor` não existe; `theme` ausente no target.

- [ ] **Step 3: Implementar**

Em `policy.ts`:

```ts
import type { MusicTheme } from './music';

const THEMES: ReadonlySet<string> = new Set<string>(['classic', 'volcano', 'glacier']);

/** Id da expansão ativa (seam 4.6/8.3) → tema musical. Desconhecido ⇒ `classic`. */
export function musicThemeFor(expansionId: string): MusicTheme {
  return THEMES.has(expansionId) ? (expansionId as MusicTheme) : 'classic';
}
```

`AudioInput` ganha `readonly expansionId: string;`; `AudioTarget` ganha `readonly theme: MusicTheme;`
e todos os `return` de `resolveAudioTarget` passam a incluir `theme: musicThemeFor(input.expansionId)`.

Em `index.ts`, dentro do `effect`: acrescentar `expansionId: entitlementsService.activeExpansion.value.id`
ao input, e trocar a decisão de reprodução por:

```ts
      if (this.engine.running !== target.track || this.engine.runningTheme !== target.theme) {
        this.engine.playMusic(target.track, target.musicGain, target.theme);
      } else {
        this.engine.setMusicGain(target.musicGain);
      }
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run tests/services/audio/ && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/audio/ tests/services/audio/
git commit -m "feat(9.6): música por tema da expansão ativa (troca ao vivo)"
```

---

### Task 5: `audioEvents.ts` — detector puro + fio no `GameScene`

**Files:**
- Create: `src/render/audioEvents.ts`
- Create: `tests/render/audioEvents.test.ts`
- Modify: `src/render/GameScene.ts` (instanciar o detector, chamá-lo no `update`, encaminhar ao
  `audioService`)

**Interfaces:**
- Consumes: `WorldState` de `@core/sim`; `SfxId` de `@services/audio` (Task 2);
  `audioService.playSfx(id)` de `@services/audio`.
- Produces:
  ```ts
  export class AudioEventDetector {
    reset(world: WorldState): void;
    poll(world: WorldState, out: SfxId[]): SfxId[];
  }
  ```

- [ ] **Step 1: Escrever o teste que falha**

`tests/render/audioEvents.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld } from '@core/sim';
import type { WorldState } from '@core/sim';
import { AudioEventDetector } from '@render/audioEvents';
import type { SfxId } from '@services/audio';

let world: WorldState;
let det: AudioEventDetector;
const out: SfxId[] = [];

beforeEach(() => {
  world = createWorld({ seed: 'audio-events' });
  det = new AudioEventDetector();
  det.reset(world);
});

describe('AudioEventDetector', () => {
  it('nada muda ⇒ nenhum evento', () => {
    expect(det.poll(world, out)).toEqual([]);
  });

  it('borda de flap dispara uma vez', () => {
    world.lastFlap = true;
    expect(det.poll(world, out)).toEqual(['flap']);
    expect(det.poll(world, out)).toEqual([]); // segurado, sem nova borda
    world.lastFlap = false;
    expect(det.poll(world, out)).toEqual([]);
    world.lastFlap = true;
    expect(det.poll(world, out)).toEqual(['flap']);
  });

  it('comida coletada dispara coin', () => {
    world.food += 1;
    expect(det.poll(world, out)).toEqual(['coin']);
  });

  it('near-miss dispara nearMiss', () => {
    world.nearMisses += 1;
    expect(det.poll(world, out)).toEqual(['nearMiss']);
  });

  it('subir de nível dispara levelUp', () => {
    world.level += 1;
    expect(det.poll(world, out)).toEqual(['levelUp']);
  });

  it('novo efeito ativo dispara powerup', () => {
    world.effects.push({ kind: 'shield', remaining: 300 });
    expect(det.poll(world, out)).toEqual(['powerup']);
    expect(det.poll(world, out)).toEqual([]); // mesmo efeito, sem repetir
  });

  it('ganhar vida extra dispara powerup; perder dispara block', () => {
    world.extraLives += 1;
    expect(det.poll(world, out)).toEqual(['powerup']);
    world.extraLives -= 1;
    expect(det.poll(world, out)).toEqual(['block']);
  });

  it('morte dispara hit', () => {
    world.alive = false;
    expect(det.poll(world, out)).toEqual(['hit']);
    expect(det.poll(world, out)).toEqual([]);
  });

  it('vários eventos no mesmo poll', () => {
    world.food += 1;
    world.nearMisses += 1;
    world.alive = false;
    expect(det.poll(world, out).sort()).toEqual(['coin', 'hit', 'nearMiss']);
  });

  it('reset religa o baseline (restart não dispara nada)', () => {
    world.food += 5;
    world.level += 2;
    det.reset(world);
    expect(det.poll(world, out)).toEqual([]);
  });

  it('reusa o array de saída', () => {
    world.food += 1;
    const returned = det.poll(world, out);
    expect(returned).toBe(out);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/render/audioEvents.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/render/audioEvents.ts`**

```ts
// Módulo PURO (sem phaser/DOM/WebAudio): traduz mudanças de `WorldState` em ids de SFX.
// Diff de escalares guardados em campos primitivos ⇒ alocação-zero por frame (REGRA 3).
// NÃO toca `src/core/`: só LÊ o estado que a simulação já produz.
import type { WorldState } from '@core/sim';
import type { PowerupKind } from '@core/powerup';
import type { SfxId } from '@services/audio';

/** Bitmask dos kinds temporários — comparar efeitos sem alocar Set/array por frame. */
const KIND_BITS: Readonly<Record<PowerupKind, number>> = {
  shield: 1, slowMo: 2, magnet: 4, doubleCoin: 8, extraLife: 16,
};

function effectMask(world: WorldState): number {
  let mask = 0;
  for (const e of world.effects) mask |= KIND_BITS[e.kind] ?? 0;
  return mask;
}

export class AudioEventDetector {
  private food = 0;
  private nearMisses = 0;
  private level = 0;
  private extraLives = 0;
  private effects = 0;
  private lastFlap = false;
  private alive = true;

  /** Rearma o baseline a partir do mundo (chamar na troca de partida). */
  reset(world: WorldState): void {
    this.food = world.food;
    this.nearMisses = world.nearMisses;
    this.level = world.level;
    this.extraLives = world.extraLives;
    this.effects = effectMask(world);
    this.lastFlap = world.lastFlap;
    this.alive = world.alive;
  }

  /** Eventos desde o último poll, escritos em `out` (esvaziado antes). */
  poll(world: WorldState, out: SfxId[]): SfxId[] {
    out.length = 0;
    if (world.lastFlap && !this.lastFlap) out.push('flap');
    if (world.food > this.food) out.push('coin');
    if (world.nearMisses > this.nearMisses) out.push('nearMiss');
    if (world.level > this.level) out.push('levelUp');
    const mask = effectMask(world);
    const gainedEffect = (mask & ~this.effects) !== 0;
    if (gainedEffect || world.extraLives > this.extraLives) out.push('powerup');
    if (world.extraLives < this.extraLives && world.alive) out.push('block');
    if (this.alive && !world.alive) out.push('hit');

    this.lastFlap = world.lastFlap;
    this.food = world.food;
    this.nearMisses = world.nearMisses;
    this.level = world.level;
    this.extraLives = world.extraLives;
    this.effects = mask;
    this.alive = world.alive;
    return out;
  }
}
```

- [ ] **Step 4: Ligar no `GameScene`**

No `GameScene.ts`: importar `AudioEventDetector`, `audioService` (`@services/audio`) e `SfxId`;
adicionar os campos

```ts
  private readonly audioEvents = new AudioEventDetector();
  private readonly sfxScratch: SfxId[] = [];
  private audioMatchId = -1; // identidade da partida corrente p/ detectar restart
```

No `update`, logo após obter `world` (e ANTES de desenhar), acrescentar:

```ts
    // 9.6: eventos de gameplay → SFX. `world.tick` volta a 0 no restart ⇒ rearma o baseline.
    if (world.tick < this.audioMatchId) this.audioEvents.reset(world);
    this.audioMatchId = world.tick;
    for (const id of this.audioEvents.poll(world, this.sfxScratch)) audioService.playSfx(id);
```

E o `gameOver` (que é um SFX de cauda longa) sai do detector: no ponto em que a `GameScene` já
detecta a transição para `dying` (a transição 1× de 9.3), disparar
`audioService.playSfx('gameOver')`.

- [ ] **Step 5: Rodar os testes**

Run: `npx vitest run tests/render/ && npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/render/audioEvents.ts src/render/GameScene.ts tests/render/audioEvents.test.ts
git commit -m "feat(9.6): SFX por evento de gameplay (detector puro + fio no GameScene)"
```

---

### Task 6: seam de faixa de arquivo (Suno) + docs

**Files:**
- Create: `src/services/audio/musicSource.ts`
- Create: `tests/services/audio/musicSource.test.ts`
- Create: `public/audio/README.md`
- Modify: `src/services/audio/engine.ts` (tentativa de arquivo + crossfade + fallback)
- Modify: `docs/audio/specs/music.menu.md`, `docs/audio/specs/music.gameplay.md`,
  `docs/audio/specs/sfx.click.md` (atualizar para o desenho novo; criar
  `docs/audio/specs/sfx.gameplay.md` descrevendo os 8 SFX de evento)

**Interfaces:**
- Consumes: `MusicTheme`, `MusicTrack`.
- Produces:
  ```ts
  export function musicFileUrl(theme: MusicTheme, track: MusicTrack, base: string): string;
  ```

- [ ] **Step 1: Escrever o teste que falha**

`tests/services/audio/musicSource.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { musicFileUrl } from '@services/audio/musicSource';

describe('musicFileUrl', () => {
  it('monta a URL sob a base da app', () => {
    expect(musicFileUrl('classic', 'menu', '/')).toBe('/audio/classic/menu.mp3');
    expect(musicFileUrl('volcano', 'gameplay', '/JurassicRun/'))
      .toBe('/JurassicRun/audio/volcano/gameplay.mp3');
  });

  it('normaliza base sem barra final', () => {
    expect(musicFileUrl('glacier', 'menu', '/sub')).toBe('/sub/audio/glacier/menu.mp3');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/services/audio/musicSource.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `musicSource.ts`**

```ts
// Seam de trilha de ARQUIVO (Regra 2 aplicada a áudio): se existir o MP3 no caminho abaixo, ele
// toca no lugar da música procedural. Sem arquivo ⇒ procedural, sem custo e sem rede.
// Briefing de geração: docs/audio/specs/SUNO-BRIEF.md
import type { MusicTheme } from './music';
import type { MusicTrack } from './tracks';

export function musicFileUrl(theme: MusicTheme, track: MusicTrack, base: string): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}audio/${theme}/${track}.mp3`;
}
```

- [ ] **Step 4: Ligar no engine (com fallback)**

No `WebAudioEngine`, adicionar:

```ts
  private readonly fileBuffers = new Map<string, AudioBuffer>();
  private readonly missingFiles = new Set<string>();
  private fileSource: AudioBufferSourceNode | null = null;
  private fileGain: GainNode | null = null;
  /** Token da reprodução corrente: um fetch que resolve tarde não pode ressuscitar faixa antiga. */
  private playToken = 0;
```

`playMusic` passa a: (1) iniciar o procedural imediatamente como hoje; (2) chamar
`void this.tryFile(track, theme, this.playToken)`. `stopMusic` também para o `fileSource`
(`stop()` + `disconnect()`), zera `fileSource`/`fileGain` e incrementa `playToken`.

```ts
  private async tryFile(track: MusicTrack, theme: MusicTheme, token: number): Promise<void> {
    const ctx = this.ctx;
    if (ctx === null) return;
    const url = musicFileUrl(theme, track, this.baseUrl);
    if (this.missingFiles.has(url)) return;
    let buffer = this.fileBuffers.get(url);
    if (buffer === undefined) {
      try {
        const res = await fetch(url);
        if (!res.ok) { this.missingFiles.add(url); return; }
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
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(g);
    g.connect(this.musicBus);
    src.start();
    this.fileSource = src;
    this.fileGain = g;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } // para o procedural
  }
```

`baseUrl` é um campo `private readonly baseUrl: string = import.meta.env.BASE_URL;`.

**Atenção:** `stopMusic` é chamado no início de `playMusic` — garanta que ele NÃO desmonte o
`_running` recém-setado (ordem: `stopMusic()` primeiro, depois setar `_running`/`_theme`, como já
está).

- [ ] **Step 5: Escrever o README do diretório de áudio**

`public/audio/README.md`:

```markdown
# Trilhas de música (opcionais)

Solte aqui as faixas geradas no Suno (ver `docs/audio/specs/SUNO-BRIEF.md`):

    public/audio/classic/menu.mp3
    public/audio/classic/gameplay.mp3
    public/audio/volcano/{menu,gameplay}.mp3
    public/audio/glacier/{menu,gameplay}.mp3

Sem arquivo, o jogo toca a música **procedural** (item 9.6) — nada quebra.
Com arquivo, ele entra em crossfade sobre a camada procedural na primeira reprodução.

Estes MP3 **não** entram no precache do Service Worker (`globPatterns` só cobre
`js,css,html,png,svg,ico,woff2`): são grandes e opcionais. Mantenha cada faixa abaixo de ~3 MB.
```

- [ ] **Step 6: Atualizar os asset-specs de áudio**

Reescrever `docs/audio/specs/music.menu.md` e `music.gameplay.md` descrevendo o modelo de
camadas (bpm, modo, timbres por tema) e apontando para `SUNO-BRIEF.md` como a via de arte real.
Atualizar `sfx.click.md` para o desenho de 2 camadas e criar `docs/audio/specs/sfx.gameplay.md`
listando os 8 SFX de evento (gatilho, desenho sonoro, duração).

- [ ] **Step 7: Rodar tudo**

Run: `npm test && npm run check`
Expected: suíte verde, check limpo.

- [ ] **Step 8: Commit**

```bash
git add src/services/audio/ tests/services/audio/ public/audio/README.md docs/audio/
git commit -m "feat(9.6): seam de faixa de arquivo (Suno) com fallback procedural + docs de áudio"
```

---

### Task 7: validação no browser + fechamento

**Files:**
- Modify: `docs/roadmap/PHASE-09-structural-improvements.md` (marcar 9.6 e escrever a nota)
- Modify: `CLAUDE.md` (métricas e estado da Frente C)

- [ ] **Step 1: Build de produção e servir**

Run: `npm run build && npx vite preview --port 4173`

- [ ] **Step 2: Validar no Playwright**

Com o SW desregistrado (gotcha recorrente: `unregister` + `caches.delete` + `?nocache`):
1. Home ⇒ clicar em algo (unlock) ⇒ `AudioContext.state === 'running'`, sem erro no console.
2. Ir para Jogar ⇒ a faixa corrente muda (expor TEMP `window.__jr96 = audioService` para ler
   `engine.running`/`runningTheme`; REVERTER a exposição no fim).
3. Trocar a expansão ativa para `volcano` ⇒ `runningTheme === 'volcano'`.
4. Jogar até coletar comida/morrer ⇒ os ids `flap`/`coin`/`hit`/`gameOver` aparecem (injetar
   `nullAudioEngine()` via `audioService.init` na página de teste e ler `sfxPlayed`).
5. Medir fps por ~10 s no gameplay com música tocando; comparar com o baseline do item 9.5
   (não deve regredir de forma perceptível).
6. `console.error`/`console.warn` = 0.

- [ ] **Step 3: Reverter qualquer exposição TEMP**

Run: `git diff` — nenhuma referência a `window.__jr96` deve sobrar.

- [ ] **Step 4: Verificação final**

Run: `npm test && npm run check && npm run test:determinism`
Expected: suíte verde, check limpo, determinismo **67** (core intocado).

- [ ] **Step 5: Marcar o item e commitar**

Marcar `9.6` como concluído em `docs/roadmap/PHASE-09-structural-improvements.md` com a nota de
decisões/gotchas; atualizar as métricas em `CLAUDE.md`.

```bash
git add docs/roadmap/PHASE-09-structural-improvements.md CLAUDE.md
git commit -m "docs(9.6): fecha o item de áudio procedural rico"
```

---

## Self-review (feito)

- **Cobertura da spec:** música multi-camada (T1+T3) · SFX por evento (T2+T5) · seam de arquivo
  (T6) · tema por expansão (T4) · testes puros (T1,2,4,5,6) · validação de browser (T7). Sem
  lacunas.
- **Consistência de tipos:** `MusicTheme`/`Timbre`/`Voice` definidos na T1 e usados igual em
  T2/T3/T4/T6; `SfxId` definido na T2 e consumido em T3/T5; `playMusic(track, gain, theme)`
  declarado na T3 e chamado assim na T4/T6.
- **Sem placeholder:** todo passo de código traz o código.
- **Core intocado** em todas as tasks ⇒ determinismo 67 por construção.
