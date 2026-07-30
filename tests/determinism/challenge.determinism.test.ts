import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { challengeModifiersForSeed, challengeWorldConfig } from '@core/challenge';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';

const TL = buildTimeline(1200, (i) => i % 6 === 0);

/** Roda a timeline com `batch` steps por "frame" (simula o acumulador do render). */
function runBatched(config: WorldConfig, timeline: readonly InputFrame[], batch: number): WorldState {
  const w = createWorld(config);
  let i = 0;
  while (i < timeline.length) {
    for (let b = 0; b < batch && i < timeline.length; b++, i++) step(w, timeline[i]!);
  }
  return w;
}

describe('determinismo do modo desafio', () => {
  it('mesma seed + mesma timeline ⇒ mesmo hash final', () => {
    const cfg = challengeWorldConfig('daily:2026-02-14');
    expect(hashState(simulate(cfg, TL))).toBe(hashState(simulate(cfg, TL)));
  });

  it('desafio ≠ endless na mesma seed (os mods realmente mudam a partida)', () => {
    const seed = 'daily:2026-02-14';
    const chall = hashState(simulate(challengeWorldConfig(seed), TL));
    const endless = hashState(simulate({ seed, trait: 'none' }, TL));
    expect(chall).not.toBe(endless);
  });

  it('seeds de desafio diferentes ⇒ hashes diferentes', () => {
    const a = hashState(simulate(challengeWorldConfig('daily:2026-02-14'), TL));
    const b = hashState(simulate(challengeWorldConfig('daily:2026-02-15'), TL));
    expect(a).not.toBe(b);
  });

  it('os modificadores da seed são os aplicados pelo mundo', () => {
    const seed = 'weekly:2026-W07';
    const mods = challengeModifiersForSeed(seed);
    const w = createWorld(challengeWorldConfig(seed));
    expect(w.weather).toBe(mods.forcedWeather);
    expect(w.weatherGenerator).toBeNull();
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ mesmo hash final', () => {
    const cfg = challengeWorldConfig('daily:2026-02-14');
    const one = hashState(runBatched(cfg, TL, 1));
    const two = hashState(runBatched(cfg, TL, 2));
    const five = hashState(runBatched(cfg, TL, 5));
    expect(two).toBe(one);
    expect(five).toBe(one);
  });
});
