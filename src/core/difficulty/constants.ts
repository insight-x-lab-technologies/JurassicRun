// Constantes de tuning da curva de dificuldade. Placeholders; afinados na Fase 2.
// A dificuldade é uma curva de ESCALAS (multiplicadores adimensionais) ancorada em 1.0
// na distância 0 ⇒ comportamento inicial idêntico ao base. distance ≥ 0 (monotônica).

/** Velocidade-teto como múltiplo da velocidade-base (2 ⇒ até 2× a base). */
export const SPEED_SCALE_MAX = 2;
/** Distância em que speedScale atinge metade do caminho até SPEED_SCALE_MAX. */
export const SPEED_HALF_DISTANCE = 3000;
/** Piso do gap como fração do gap-base (0.6 ⇒ obstáculos chegam a 60% do espaçamento). */
export const GAP_SCALE_MIN = 0.6;
/** Distância em que gapScale atinge metade do caminho até GAP_SCALE_MIN. */
export const GAP_HALF_DISTANCE = 3000;
/** Distância (unidades de mundo) por degrau de nível. */
export const DISTANCE_PER_LEVEL = 500;
