import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';
import { difficultyAt } from '@core/difficulty';

// Mundo alto p/ a partida durar; seed liga obstáculos (gapScale da dificuldade ativo).
const SEEDED: WorldConfig = { worldHeight: 100000, startY: 50000, seed: 'endless:DIFF1' };

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

describe('determinismo da dificuldade', () => {
  it('reprodutibilidade: mesma seed+timeline ⇒ distance/level/scrollSpeed/obstáculos idênticos', () => {
    const t = makeTimeline(1200);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.distance).toBe(b.distance);
    expect(a.level).toBe(b.level);
    expect(a.scrollSpeed).toBe(b.scrollSpeed);
    expect(a.obstacles).toEqual(b.obstacles);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico (velocidade variável)', () => {
    const t = makeTimeline(1200);
    const one = runBatched(SEEDED, t, 1);
    const two = runBatched(SEEDED, t, 2);
    const five = runBatched(SEEDED, t, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('duas partidas frescas ⇒ dificuldade idêntica na mesma distância (reset por partida)', () => {
    const t = makeTimeline(800);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(difficultyAt(a.distance)).toEqual(difficultyAt(b.distance));
    expect(a.level).toBe(difficultyAt(a.distance).level);
  });
});
