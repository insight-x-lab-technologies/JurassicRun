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
