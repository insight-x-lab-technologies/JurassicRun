import { describe, it, expect } from 'vitest';
import {
  scoreDelta,
  DISTANCE_SCORE_WEIGHT,
  FOOD_SCORE_VALUE,
  NEAR_MISS_SCORE_VALUE,
} from '@core/economy';

describe('scoreDelta', () => {
  it('só distância: aplica DISTANCE_SCORE_WEIGHT', () => {
    expect(scoreDelta(10, 0, 0, 1)).toBe(10 * DISTANCE_SCORE_WEIGHT);
  });

  it('só comida: aplica FOOD_SCORE_VALUE por unidade', () => {
    expect(scoreDelta(0, 3, 0, 1)).toBe(3 * FOOD_SCORE_VALUE);
  });

  it('só near-miss: aplica NEAR_MISS_SCORE_VALUE por unidade', () => {
    expect(scoreDelta(0, 0, 2, 1)).toBe(2 * NEAR_MISS_SCORE_VALUE);
  });

  it('multiplicador 1 (default): soma simples dos componentes ponderados', () => {
    const expected =
      5 * DISTANCE_SCORE_WEIGHT + 2 * FOOD_SCORE_VALUE + 1 * NEAR_MISS_SCORE_VALUE;
    expect(scoreDelta(5, 2, 1, 1)).toBe(expected);
  });

  it('multiplicador 2 dobra a soma; 0 zera; fracionário escala', () => {
    const base = scoreDelta(5, 2, 1, 1);
    expect(scoreDelta(5, 2, 1, 2)).toBe(base * 2);
    expect(scoreDelta(5, 2, 1, 0)).toBe(0);
    expect(scoreDelta(5, 2, 1, 1.5)).toBe(base * 1.5);
  });

  it('deltas zero ⇒ 0', () => {
    expect(scoreDelta(0, 0, 0, 1)).toBe(0);
  });

  it('puro/idempotente: mesmos argumentos ⇒ mesmo resultado', () => {
    expect(scoreDelta(7.25, 1, 3, 2)).toBe(scoreDelta(7.25, 1, 3, 2));
  });

  it('valores grandes: aritmética float sã', () => {
    expect(scoreDelta(1e6, 1000, 1000, 1)).toBe(
      1e6 * DISTANCE_SCORE_WEIGHT + 1000 * FOOD_SCORE_VALUE + 1000 * NEAR_MISS_SCORE_VALUE,
    );
  });
});
