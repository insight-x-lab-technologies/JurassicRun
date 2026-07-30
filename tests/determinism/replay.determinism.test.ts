import { describe, it, expect } from 'vitest';
import type { WorldConfig } from '@core/sim';
import { simulate, buildTimeline, hashState } from '@core/replay';

/** Cadência de flap fixa por cenário (determinística). */
const flapEvery = (n: number) => (i: number) => i % n === 0;

interface Scenario {
  name: string;
  config: WorldConfig;
  length: number;
  pattern: (i: number) => boolean;
  golden: string; // preenchido na 1ª execução (ver Step 2/3)
}

const BASE: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
};

const SCENARIOS: Scenario[] = [
  {
    name: 'sem seed — só física até a morte',
    config: { ...BASE },
    length: 400,
    pattern: () => false,
    golden: '92a8629a29f52b943618b12d8a2d8fee',
  },
  {
    name: 'com seed — sobrevive bastante (flap regular)',
    config: { ...BASE, seed: 'endless:GOLD1' },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'f279e70b85394287bb531de51db7af7c',
  },
  {
    name: 'com seed — difficulty:false',
    config: { ...BASE, seed: 'endless:GOLD1', difficulty: false },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'd3a9d72c8638add90d59277e686b9299',
  },
  {
    name: 'com seed diferente',
    config: { ...BASE, seed: 'endless:GOLD2' },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'c7a668f7c4f3fecbf55119b97c27d54b',
  },
  {
    name: 'modo desafio — mods derivados da seed',
    config: { ...BASE, seed: 'daily:2026-01-01', challenge: true },
    length: 1500,
    pattern: flapEvery(6),
    golden: '471552c558c704a9442bc6f5c45fc351',
  },
];

describe('golden master — replay determinístico', () => {
  for (const s of SCENARIOS) {
    it(`pino estável: ${s.name}`, () => {
      const hash = hashState(simulate(s.config, buildTimeline(s.length, s.pattern)));
      expect(hash).toBe(s.golden);
    });
  }

  it('seeds diferentes ⇒ hashes diferentes (GOLD1 vs GOLD2)', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const a = hashState(simulate({ ...BASE, seed: 'endless:GOLD1' }, tl));
    const b = hashState(simulate({ ...BASE, seed: 'endless:GOLD2' }, tl));
    expect(a).not.toBe(b);
  });

  it('difficulty on vs off ⇒ hashes diferentes', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const on = hashState(simulate({ ...BASE, seed: 'endless:GOLD1' }, tl));
    const off = hashState(simulate({ ...BASE, seed: 'endless:GOLD1', difficulty: false }, tl));
    expect(on).not.toBe(off);
  });
});
