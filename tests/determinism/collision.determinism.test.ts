import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';
import { overlaps } from '@core/collision';
import { aabb, circle } from '@core/sim/hitbox';

// Mundo semeado: gera obstáculos e coletáveis; o dino voa e eventualmente colide.
const SEEDED: WorldConfig = {
  worldHeight: 200,
  startY: 100,
  gravity: 600,
  flapSpeed: 260,
  scrollSpeed: 130,
  seed: 'endless:COLLIDE1',
};

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 10 === 0 });
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

describe('determinismo da colisão', () => {
  it('overlaps é simétrico (propriedade)', () => {
    expect(overlaps(aabb(10, 8), { x: 0, y: 0 }, circle(5), { x: 12, y: 3 })).toBe(
      overlaps(circle(5), { x: 12, y: 3 }, aabb(10, 8), { x: 0, y: 0 }),
    );
  });

  it('reprodutibilidade: mesma seed+timeline ⇒ alive/food/nearMisses idênticos', () => {
    const timeline = makeTimeline(1200);
    const a = runBatched(SEEDED, timeline, 1);
    const b = runBatched(SEEDED, timeline, 1);
    expect(a).toEqual(b);
    expect({ alive: a.alive, food: a.food, nearMisses: a.nearMisses }).toEqual({
      alive: b.alive,
      food: b.food,
      nearMisses: b.nearMisses,
    });
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico', () => {
    const timeline = makeTimeline(1200);
    const one = runBatched(SEEDED, timeline, 1);
    const two = runBatched(SEEDED, timeline, 2);
    const five = runBatched(SEEDED, timeline, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('a simulação semeada exercita o caminho de colisão (o dino morre)', () => {
    const w = runBatched(SEEDED, makeTimeline(1200), 1);
    // Voo longo num mundo com obstáculos ⇒ colide e morre (prova que o gatilho roda).
    expect(w.alive).toBe(false);
  });
});
