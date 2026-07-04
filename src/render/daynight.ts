/**
 * Tempo do dia (item 3.3) — cosmético PURO, derivado da seed da partida. Não toca `src/core/`
 * nem `WorldState` (REGRA 1): é só paleta de fundo, como parallax (2.3). Trocar por arte real
 * (gradientes/sprites de céu, Fase 8) = editar o catálogo, não a lógica (REGRA 2).
 */
import { hashSeed } from '@core/rng';

export type TimeOfDay = 'morning' | 'afternoon' | 'dusk' | 'night';

/** Cores de uma fase do dia. `parallaxTint` é multiplicativo (0xffffff = sem alteração). */
export interface DayNightPalette {
  readonly sky: number;
  readonly ground: number;
  readonly ceiling: number;
  readonly parallaxTint: number;
}

/** Ordem estável usada na seleção por módulo (amanhecer→noite). */
export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] = ['morning', 'afternoon', 'dusk', 'night'];

/**
 * Paletas por fase. Valores são PLACEHOLDERS de tuning cosmético (Fase 8 refina).
 * `afternoon` herda o look atual (SKY/GROUND/CEILING de constants.ts) ⇒ sem regressão visual.
 */
export const DAY_NIGHT_PALETTES: Readonly<Record<TimeOfDay, DayNightPalette>> = {
  morning: { sky: 0xffdcb0, ground: 0x4a7038, ceiling: 0x4a3a52, parallaxTint: 0xffe0c0 },
  afternoon: { sky: 0x9ad4e6, ground: 0x4a7a3a, ceiling: 0x3a2f4a, parallaxTint: 0xffffff },
  dusk: { sky: 0xff9e6b, ground: 0x3f5a34, ceiling: 0x52304a, parallaxTint: 0xffb080 },
  night: { sky: 0x1a2340, ground: 0x24331f, ceiling: 0x1e1830, parallaxTint: 0x5566aa },
};

/** Paleta de uma fase. */
export function paletteFor(tod: TimeOfDay): DayNightPalette {
  return DAY_NIGHT_PALETTES[tod];
}

/**
 * Fase do dia de uma partida: função determinística da seed via `hashSeed` (xmur3 portável do
 * core). Endless (token aleatório) varia de partida em partida; Diário/Semanal (Fase 5) fica
 * reproduzível para todos.
 */
export function timeOfDayForSeed(seed: string): TimeOfDay {
  const idx = hashSeed(seed) % TIME_OF_DAY_ORDER.length;
  return TIME_OF_DAY_ORDER[idx]!;
}
