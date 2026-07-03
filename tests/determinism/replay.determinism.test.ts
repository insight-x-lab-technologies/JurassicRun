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
    golden: 'a38628a66ad6c6de49ef8f023ef6baeb',
  },
  {
    name: 'com seed — sobrevive bastante (flap regular)',
    config: { ...BASE, seed: 'endless:GOLD1' },
    length: 1500,
    pattern: flapEvery(6),
    golden: '65a046db6bd4d3436d3ec122bef39eae',
  },
  {
    name: 'com seed — difficulty:false',
    config: { ...BASE, seed: 'endless:GOLD1', difficulty: false },
    length: 1500,
    pattern: flapEvery(6),
    golden: '634716556a51e477e325c20fdd06947e',
  },
  {
    name: 'com seed diferente',
    config: { ...BASE, seed: 'endless:GOLD2' },
    length: 1500,
    pattern: flapEvery(6),
    golden: '26f2b8a04a1a697ea39b64d540c66609',
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
