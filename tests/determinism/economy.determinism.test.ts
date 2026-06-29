import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';

// Mundo alto p/ a partida durar; seed liga obstáculos e coletáveis (comida/near-miss pontuam).
const SEEDED: WorldConfig = { worldHeight: 100000, startY: 50000, seed: 'endless:ECON1' };

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 2 === 0 });
  return out;
}

function runBatched(config: WorldConfig, timeline: InputFrame[], batch: number): WorldState {
  const w = createWorld(config);
  let i = 0;
  while (i < timeline.length) {
    for (let b = 0; b < batch && i < timeline.length; b++, i++) step(w, timeline[i]!);
  }
  return w;
}

describe('determinismo da economia/score', () => {
  it('reprodutibilidade: mesma seed+timeline ⇒ score idêntico', () => {
    const t = makeTimeline(1500);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.score).toBe(b.score);
    expect(a.food).toBe(b.food);
    expect(a.nearMisses).toBe(b.nearMisses);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ score idêntico', () => {
    const t = makeTimeline(1500);
    const one = runBatched(SEEDED, t, 1);
    const two = runBatched(SEEDED, t, 2);
    const five = runBatched(SEEDED, t, 5);
    expect(two.score).toBe(one.score);
    expect(five.score).toBe(one.score);
    // Estado completo idêntico (score incluso) reforça o contrato.
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('duas partidas frescas com a mesma seed ⇒ mesmo score na mesma distância', () => {
    const t = makeTimeline(900);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.distance).toBe(b.distance);
    expect(a.score).toBe(b.score);
  });
});
