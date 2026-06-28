import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';

describe('Rng — distribuição básica (pega quebras grosseiras)', () => {
  it('média de next() ≈ 0.5', () => {
    const r = createRng('mean');
    let sum = 0;
    const N = 200_000;
    for (let i = 0; i < N; i++) sum += r.next();
    expect(Math.abs(sum / N - 0.5)).toBeLessThan(0.01);
  });

  it('int(0, B-1) preenche todos os baldes com frequência aproximadamente uniforme', () => {
    const r = createRng('hist');
    const B = 10;
    const N = 100_000;
    const buckets = new Array<number>(B).fill(0);
    for (let i = 0; i < N; i++) {
      const idx = r.int(0, B - 1);
      buckets[idx]!++;
    }
    const expected = N / B;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(0);
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.1);
    }
  });

  it('pick cobre todos os índices ao longo de muitas amostras', () => {
    const r = createRng('cover');
    const arr = [0, 1, 2, 3, 4];
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(r.pick(arr));
    expect(seen.size).toBe(arr.length);
  });
});
