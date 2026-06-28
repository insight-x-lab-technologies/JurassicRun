import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';

describe('Rng — range/int/pick', () => {
  it('range(min,max) fica em [min, max)', () => {
    const r = createRng('range');
    for (let i = 0; i < 1000; i++) {
      const v = r.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('range com min >= max retorna min', () => {
    const r = createRng('range-deg');
    expect(r.range(5, 5)).toBe(5);
    expect(r.range(8, 3)).toBe(8);
  });

  it('int(min,max) é inteiro inclusivo nas duas bordas', () => {
    const r = createRng('int');
    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 5000; i++) {
      const v = r.int(1, 3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      if (v === 1) sawMin = true;
      if (v === 3) sawMax = true;
    }
    expect(sawMin && sawMax).toBe(true);
  });

  it('int(n,n) retorna n', () => {
    const r = createRng('int-deg');
    expect(r.int(7, 7)).toBe(7);
  });

  it('pick retorna um elemento do array', () => {
    const r = createRng('pick');
    const arr = ['a', 'b', 'c', 'd'] as const;
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it('pick em array vazio lança', () => {
    const r = createRng('pick-empty');
    expect(() => r.pick([])).toThrow();
  });
});
