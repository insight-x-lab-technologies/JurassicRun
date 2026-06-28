import { describe, it, expect } from 'vitest';
import { MULBERRY32_INCREMENT, scramble, xmur3Hash } from '@core/rng/mulberry32';

// Reproduz a sequência mulberry32 a partir de uma seed hasheada por xmur3.
function sequence(seed: string, count: number): number[] {
  let state = xmur3Hash(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    state = (state + MULBERRY32_INCREMENT) | 0;
    out.push(scramble(state));
  }
  return out;
}

describe('mulberry32 + xmur3 (primitivas determinísticas)', () => {
  it('xmur3Hash é estável para uma seed conhecida', () => {
    expect(xmur3Hash('jurassic')).toBe(4256126911);
  });

  it('scramble retorna uint32 em [0, 2^32)', () => {
    for (let s = -5; s <= 5; s++) {
      const v = scramble(s);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('vetor golden: trava o algoritmo contra regressão entre máquinas/refactors', () => {
    expect(sequence('jurassic', 8)).toEqual([
      335010640, 3711962893, 2292900422, 174638367,
      1078893230, 1253953198, 2071798730, 1140601669,
    ]);
  });
});
