import {
  SPEED_SCALE_MAX,
  SPEED_HALF_DISTANCE,
  GAP_SCALE_MIN,
  GAP_HALF_DISTANCE,
  DISTANCE_PER_LEVEL,
} from './constants';

/** Parâmetros de dificuldade derivados PURAMENTE da distância. Escalas adimensionais
 * ancoradas em 1.0 na distância 0. */
export interface DifficultyParams {
  /** Nível 1-based (HUD/Game Over). Cresce em degraus com a distância. */
  level: number;
  /** Multiplicador da velocidade-base (≥ 1, cresce até SPEED_SCALE_MAX). */
  speedScale: number;
  /** Multiplicador do gap-base dos obstáculos (≤ 1, cai até GAP_SCALE_MIN). */
  gapScale: number;
}

/** Nível 1-based a partir da distância. */
export function levelForDistance(distance: number): number {
  const d = distance > 0 ? distance : 0;
  return 1 + Math.floor(d / DISTANCE_PER_LEVEL);
}

/**
 * Curva de dificuldade pura: distância → escalas + nível. Sem RNG, sem tempo.
 * Forma hiperbólica assintótica `d/(d+H)`: cresce sempre (bom p/ Endless), mas LIMITADA
 * (jogável). Só aritmética IEEE-754 portável (DETERMINISM.md §5): +, −, ·, /, floor.
 * Sem Math.pow/exp/log/hypot. `d ≥ 0` ⇒ `d + H > 0` (sem divisão por zero).
 */
export function difficultyAt(distance: number): DifficultyParams {
  const d = distance > 0 ? distance : 0;
  const speedT = d / (d + SPEED_HALF_DISTANCE); // [0, 1)
  const gapT = d / (d + GAP_HALF_DISTANCE); // [0, 1)
  return {
    level: levelForDistance(d),
    speedScale: 1 + (SPEED_SCALE_MAX - 1) * speedT,
    gapScale: 1 - (1 - GAP_SCALE_MIN) * gapT,
  };
}
