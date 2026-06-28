import { describe, it, expect } from 'vitest';
import { createRng, rngFromState, hashSeed } from '@core/rng';

function take(rng: { nextUint32(): number }, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng.nextUint32());
  return out;
}

describe('Rng — determinismo e estado', () => {
  it('hashSeed é estável e independe de número vs. string equivalente', () => {
    expect(hashSeed('jurassic')).toBe(4256126911);
    expect(hashSeed(7)).toBe(hashSeed('7'));
  });

  it('mesma seed ⇒ sequências idênticas', () => {
    const a = createRng('run-42');
    const b = createRng('run-42');
    expect(take(a, 16)).toEqual(take(b, 16));
  });

  it('seeds diferentes ⇒ sequências diferentes', () => {
    const a = take(createRng('run-1'), 16);
    const b = take(createRng('run-2'), 16);
    expect(a).not.toEqual(b);
  });

  it('next() está sempre em [0, 1)', () => {
    const r = createRng('floats');
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('state avança a cada nextUint32 e seed é exposto', () => {
    const r = createRng('state-check');
    expect(r.seed).toBe('state-check');
    const s0 = r.state;
    r.nextUint32();
    expect(r.state).not.toBe(s0);
  });

  it('rngFromState continua a sequência exatamente', () => {
    const r = createRng('replay');
    take(r, 5);
    const resumed = rngFromState(r.seed, r.state);
    expect(take(resumed, 10)).toEqual(take(r, 10));
  });

  it('clone() reproduz a sequência a partir do ponto de clonagem', () => {
    const r = createRng('clone-me');
    take(r, 3);
    const c = r.clone();
    expect(take(c, 10)).toEqual(take(r, 10));
  });

  it('golden: primeiros uint32 de createRng("jurassic")', () => {
    expect(take(createRng('jurassic'), 4)).toEqual([
      335010640, 3711962893, 2292900422, 174638367,
    ]);
  });
});
