import { describe, it, expect } from 'vitest';
import { lerp } from '@render/interpolate';

describe('lerp', () => {
  it('retorna a nos extremos t=0 e b em t=1', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it('interpola no meio', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(-4, 4, 0.25)).toBe(-2);
  });
  it('extrapola fora de [0,1] (linear)', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });
});
