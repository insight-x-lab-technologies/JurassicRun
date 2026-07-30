import { describe, it, expect } from 'vitest';
import { challengeModifiersForSeed } from '@core/challenge';
import { WEATHER_KINDS } from '@core/weather';
import { POWERUP_KINDS } from '@core/powerup';
import { createRng } from '@core/rng';

const SEEDS = ['daily:2026-01-01', 'daily:2026-07-29', 'weekly:2026-W31'];

describe('challengeModifiersForSeed', () => {
  it('é determinística: mesma seed ⇒ mesmos modificadores', () => {
    for (const seed of SEEDS) {
      expect(challengeModifiersForSeed(seed)).toEqual(challengeModifiersForSeed(seed));
    }
  });

  it('devolve sempre valores dos catálogos', () => {
    for (let d = 1; d <= 60; d++) {
      const m = challengeModifiersForSeed(`daily:2026-03-${String(d).padStart(2, '0')}`);
      expect(WEATHER_KINDS).toContain(m.forcedWeather);
      expect(POWERUP_KINDS).toContain(m.bannedPowerup);
    }
  });

  it('varia entre seeds (>1 clima e >1 power-up em 60 datas)', () => {
    const weathers = new Set<string>();
    const banned = new Set<string>();
    for (let d = 1; d <= 60; d++) {
      const m = challengeModifiersForSeed(`daily:2026-03-${String(d).padStart(2, '0')}`);
      weathers.add(m.forcedWeather);
      banned.add(m.bannedPowerup);
    }
    expect(weathers.size).toBeGreaterThan(1);
    expect(banned.size).toBeGreaterThan(1);
  });

  it('contrato de ordem: clima primeiro, power-up depois (stream "challenge")', () => {
    const seed = 'daily:2026-01-01';
    const rng = createRng(seed).fork('challenge');
    const expected = {
      forcedWeather: rng.pick(WEATHER_KINDS),
      bannedPowerup: rng.pick(POWERUP_KINDS),
    };
    expect(challengeModifiersForSeed(seed)).toEqual(expected);
  });

  it('objeto congelado (não mutável por engano)', () => {
    expect(Object.isFrozen(challengeModifiersForSeed('daily:2026-01-01'))).toBe(true);
  });
});
