import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { challengeModifiersForSeed, challengeWorldConfig } from '@core/challenge';
import { createWorld } from '@core/sim';

const TL = buildTimeline(1200, (i) => i % 6 === 0);

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
});
