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
    golden: '719f95c18de1056ce9186ee1143f6e99',
  },
  {
    name: 'com seed — sobrevive bastante (flap regular)',
    config: { ...BASE, seed: 'endless:GOLD1' },
    length: 1500,
    pattern: flapEvery(6),
    golden: '721d74af29b23715ff55e8526382014d',
  },
  {
    name: 'com seed — difficulty:false',
    config: { ...BASE, seed: 'endless:GOLD1', difficulty: false },
    length: 1500,
    pattern: flapEvery(6),
    golden: '57b3c4543c8d72df6f4ab0cb0e077381',
  },
  {
    name: 'com seed diferente',
    config: { ...BASE, seed: 'endless:GOLD2' },
    length: 1500,
    pattern: flapEvery(6),
    golden: 'b107c34c21d73f3b6ec43bba7b134ef8',
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
