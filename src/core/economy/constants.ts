// Pesos de pontuação (placeholders de tuning; afinados na Fase 2). Unidades abstratas.

/** Pontos por unidade de distância percorrida (score base). */
export const DISTANCE_SCORE_WEIGHT = 1;
/** Pontos por pássaro-moeda (comida) coletado. */
export const FOOD_SCORE_VALUE = 10;
/** Pontos por near-miss (passar perto de um obstáculo sem colidir). */
export const NEAR_MISS_SCORE_VALUE = 5;
