import { describe, it, expect } from 'vitest';
import { buildChallengeBrief } from '@app/challenge/brief';
import { challengeModifiersForSeed } from '@core/challenge';

const SEED = 'daily:2026-07-29';

describe('buildChallengeBrief', () => {
  it('extrai o rótulo do período da seed canônica', () => {
    const v = buildChallengeBrief({ seed: SEED, localEntries: [], centralEntries: [] });
    expect(v.seed).toBe(SEED);
    expect(v.periodLabel).toBe('2026-07-29');
  });

  it('sem tentativas ⇒ recordes nulos', () => {
    const v = buildChallengeBrief({ seed: SEED, localEntries: [], centralEntries: [] });
    expect(v.yourBest).toBeNull();
    expect(v.worldBest).toBeNull();
  });

  it('usa o melhor score DESTA seed, ignorando outras', () => {
    const v = buildChallengeBrief({
      seed: SEED,
      localEntries: [
        { seed: 'daily:2026-07-28', score: 999 },
        { seed: SEED, score: 120 },
      ],
      centralEntries: [
        { seed: SEED, score: 500 },
        { seed: 'daily:2026-07-28', score: 4000 },
      ],
    });
    expect(v.yourBest).toBe(120);
    expect(v.worldBest).toBe(500);
  });

  it('regras refletem os modificadores da seed + traço travado', () => {
    const mods = challengeModifiersForSeed(SEED);
    const v = buildChallengeBrief({ seed: SEED, localEntries: [], centralEntries: [] });
    expect(v.rules).toEqual([
      { kind: 'weather', valueKey: `weather.${mods.forcedWeather}` },
      { kind: 'bannedPowerup', valueKey: `powerup.${mods.bannedPowerup}.name` },
      { kind: 'trait', valueKey: 'trait.none.name' },
    ]);
  });
});
