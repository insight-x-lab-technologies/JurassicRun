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
      { timbre: 'triangle' as const, freq: 880, delaySec: 0, attackSec: 0.004, decaySec: 0.06, gain: 0.5 },
      { timbre: 'sine' as const, freq: 1320, delaySec: 0.01, attackSec: 0.004, decaySec: 0.04, gain: 0.2 },
    ],
  }),
  // Bater de asa: whoosh de ruído + corpo grave descendente.
  flap: Object.freeze({
    layers: [
      { timbre: 'noise' as const, freq: 1, delaySec: 0, attackSec: 0.01, decaySec: 0.13, gain: 0.35, filterHz: 1400 },
      { timbre: 'sine' as const, freq: 260, freqEnd: 150, delaySec: 0, attackSec: 0.008, decaySec: 0.12, gain: 0.25 },
    ],
  }),
  // Moeda: arpejo ascendente de quinta, brilhante.
  coin: Object.freeze({
    layers: [
      { timbre: 'square' as const, freq: 988, delaySec: 0, attackSec: 0.004, decaySec: 0.07, gain: 0.28 },
      { timbre: 'square' as const, freq: 1319, delaySec: 0.06, attackSec: 0.004, decaySec: 0.16, gain: 0.24 },
    ],
  }),
  // Power-up: tríade ascendente com sweep — "algo bom aconteceu".
  powerup: Object.freeze({
    layers: [
      { timbre: 'triangle' as const, freq: 523, delaySec: 0, attackSec: 0.01, decaySec: 0.12, gain: 0.3 },
      { timbre: 'triangle' as const, freq: 659, delaySec: 0.08, attackSec: 0.01, decaySec: 0.12, gain: 0.3 },
      { timbre: 'triangle' as const, freq: 784, freqEnd: 1568, delaySec: 0.16, attackSec: 0.01, decaySec: 0.3, gain: 0.26 },
    ],
  }),
  // Colisão: impacto de ruído grave + queda de sawtooth.
  hit: Object.freeze({
    layers: [
      { timbre: 'noise' as const, freq: 1, delaySec: 0, attackSec: 0.003, decaySec: 0.26, gain: 0.45, filterHz: 500 },
      { timbre: 'sawtooth' as const, freq: 180, freqEnd: 55, delaySec: 0, attackSec: 0.005, decaySec: 0.35, gain: 0.4 },
    ],
  }),
  // Game over: motivo descendente de 3 notas.
  gameOver: Object.freeze({
    layers: [
      { timbre: 'triangle' as const, freq: 392, delaySec: 0, attackSec: 0.015, decaySec: 0.3, gain: 0.32 },
      { timbre: 'triangle' as const, freq: 311, delaySec: 0.22, attackSec: 0.015, decaySec: 0.3, gain: 0.32 },
      { timbre: 'triangle' as const, freq: 233, delaySec: 0.44, attackSec: 0.02, decaySec: 0.6, gain: 0.34 },
    ],
  }),
  // Near-miss: sopro curto e discreto (é frequente — precisa ser barato de ouvir).
  nearMiss: Object.freeze({
    layers: [
      { timbre: 'noise' as const, freq: 1, delaySec: 0, attackSec: 0.02, decaySec: 0.14, gain: 0.18, filterHz: 2600 },
    ],
  }),
  // Level-up: arpejo ascendente de 4 notas.
  levelUp: Object.freeze({
    layers: [
      { timbre: 'square' as const, freq: 523, delaySec: 0, attackSec: 0.006, decaySec: 0.1, gain: 0.2 },
      { timbre: 'square' as const, freq: 659, delaySec: 0.07, attackSec: 0.006, decaySec: 0.1, gain: 0.2 },
      { timbre: 'square' as const, freq: 784, delaySec: 0.14, attackSec: 0.006, decaySec: 0.1, gain: 0.2 },
      { timbre: 'square' as const, freq: 1047, delaySec: 0.21, attackSec: 0.006, decaySec: 0.28, gain: 0.22 },
    ],
  }),
  // Escudo/vida extra absorvendo o golpe: ping metálico.
  block: Object.freeze({
    layers: [
      { timbre: 'sine' as const, freq: 1200, freqEnd: 700, delaySec: 0, attackSec: 0.004, decaySec: 0.22, gain: 0.3 },
      { timbre: 'noise' as const, freq: 1, delaySec: 0, attackSec: 0.003, decaySec: 0.09, gain: 0.2, filterHz: 3500 },
    ],
  }),
});

export const SFX_IDS: readonly SfxId[] = Object.freeze(Object.keys(SFX_CATALOG) as SfxId[]);
