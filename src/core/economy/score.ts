import { DISTANCE_SCORE_WEIGHT, FOOD_SCORE_VALUE, NEAR_MISS_SCORE_VALUE } from './constants';

/**
 * Pontos ganhos num passo, dados os incrementos do passo e o multiplicador ativo.
 * Acúmulo incremental: o chamador faz `score += scoreDelta(...)` por step, de modo que um
 * multiplicador temporário (power-up da Fase 3) banca pontos à taxa ativa no momento em que
 * foram ganhos. Puro: só +, −, · (DETERMINISM.md §5); sem RNG, sem tempo, sem transcendentais.
 */
export function scoreDelta(
  distanceDelta: number,
  foodDelta: number,
  nearMissDelta: number,
  multiplier: number,
): number {
  const base =
    distanceDelta * DISTANCE_SCORE_WEIGHT +
    foodDelta * FOOD_SCORE_VALUE +
    nearMissDelta * NEAR_MISS_SCORE_VALUE;
  return base * multiplier;
}
