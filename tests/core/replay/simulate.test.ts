import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { WorldConfig } from '@core/sim';
import { simulate, buildTimeline } from '@core/replay';

const CONFIG: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: 'endless:SIMTEST',
};

describe('buildTimeline', () => {
  it('cria frames com flap conforme o pattern', () => {
    const tl = buildTimeline(5, (i) => i % 2 === 0);
    expect(tl.map((f) => f.flap)).toEqual([true, false, true, false, true]);
  });

  it('length 0 ⇒ timeline vazia', () => {
    expect(buildTimeline(0, () => true)).toEqual([]);
  });
});

describe('simulate', () => {
  it('equivale a createWorld + step manuais', () => {
    const tl = buildTimeline(300, (i) => i % 9 === 0);
    const manual = createWorld(CONFIG);
    for (const f of tl) step(manual, f);
    const replayed = simulate(CONFIG, tl);
    expect(replayed).toEqual(manual);
  });

  it('timeline vazia ⇒ estado inicial', () => {
    expect(simulate(CONFIG, [])).toEqual(createWorld(CONFIG));
  });

  it('reprodutível: duas chamadas iguais ⇒ estados iguais', () => {
    const tl = buildTimeline(500, (i) => i % 7 === 0);
    expect(simulate(CONFIG, tl)).toEqual(simulate(CONFIG, tl));
  });
});
