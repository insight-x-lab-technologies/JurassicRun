import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { dailySeed, weeklySeed, endlessSeed, randomEndlessToken } from '@core/seed';

function firstN(seed: string, n: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.nextUint32());
}

describe('seed derivation × Rng (determinismo)', () => {
  it('mesma data ⇒ mesma sequência do Rng', () => {
    const date = { year: 2026, month: 6, day: 28 } as const;
    expect(firstN(dailySeed(date), 8)).toEqual(firstN(dailySeed(date), 8));
  });

  it('modos diferentes na mesma data ⇒ estados iniciais distintos (namespacing)', () => {
    const date = { year: 2026, month: 6, day: 28 } as const;
    const daily = createRng(dailySeed(date)).state;
    const weekly = createRng(weeklySeed(date)).state;
    const endless = createRng(endlessSeed('2026-06-28')).state;
    expect(new Set([daily, weekly, endless]).size).toBe(3);
  });

  it('token Endless faz round-trip: token exibido ⇒ mesma seed ⇒ mesmo estado', () => {
    const token = randomEndlessToken(0xdeadbeef);
    const a = createRng(endlessSeed(token)).state;
    const b = createRng(endlessSeed(token)).state;
    expect(a).toBe(b);
  });

  it('dias diferentes ⇒ sequências diferentes', () => {
    const d1 = firstN(dailySeed({ year: 2026, month: 6, day: 28 }), 4);
    const d2 = firstN(dailySeed({ year: 2026, month: 6, day: 29 }), 4);
    expect(d1).not.toEqual(d2);
  });
});
