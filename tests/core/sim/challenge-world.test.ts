import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';
import type { WorldConfig } from '@core/sim';
import { challengeModifiersForSeed } from '@core/challenge';
import { POWERUP_KINDS, powerupKindForTag } from '@core/powerup';

const SEED = 'daily:2026-01-01';
const BASE: WorldConfig = {
  worldHeight: 180,
  startY: 90,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: SEED,
};

/** Roda a sim segurando flap em cadência fixa e devolve os kinds de power-up que spawnaram. */
function spawnedPowerupKinds(config: WorldConfig, steps: number): Set<string> {
  const w = createWorld(config);
  const seen = new Set<string>();
  for (let i = 0; i < steps; i++) {
    step(w, { flap: i % 6 === 0 });
    for (const p of w.powerups) {
      const kind = powerupKindForTag(p.tags[0] ?? '');
      if (kind !== null) seen.add(kind);
    }
    if (!w.alive) {
      w.alive = true; // sobrevive artificialmente: interessa só o stream de spawn
    }
  }
  return seen;
}

describe('createWorld em modo desafio', () => {
  it('aplica o clima forçado da seed e desliga o sequenciador de clima', () => {
    const mods = challengeModifiersForSeed(SEED);
    const w = createWorld({ ...BASE, challenge: true });
    expect(w.weather).toBe(mods.forcedWeather);
    expect(w.weatherGenerator).toBeNull();
  });

  it('mantém o clima constante ao longo da partida', () => {
    const mods = challengeModifiersForSeed(SEED);
    const w = createWorld({ ...BASE, challenge: true });
    for (let i = 0; i < 3000; i++) {
      step(w, { flap: i % 6 === 0 });
      w.alive = true;
    }
    expect(w.weather).toBe(mods.forcedWeather);
  });

  it('nunca spawna o power-up banido, mas continua spawnando os outros', () => {
    const mods = challengeModifiersForSeed(SEED);
    const seen = spawnedPowerupKinds({ ...BASE, challenge: true }, 6000);
    expect(seen.has(mods.bannedPowerup)).toBe(false);
    expect(seen.size).toBeGreaterThan(0);
    for (const k of seen) expect(POWERUP_KINDS).toContain(k as never);
  });

  it('weather:false continua vencendo (mundo sem clima) mesmo em desafio', () => {
    const w = createWorld({ ...BASE, challenge: true, weather: false });
    expect(w.weather).toBe('clear');
    expect(w.weatherGenerator).toBeNull();
  });

  it('sem a flag, o mundo é idêntico ao de antes (não-regressão)', () => {
    const a = createWorld({ ...BASE });
    const b = createWorld({ ...BASE, challenge: false });
    expect(cloneWorld(b)).toEqual(cloneWorld(a));
  });

  it('desafio difere do endless na MESMA seed', () => {
    const endless = createWorld({ ...BASE });
    const chall = createWorld({ ...BASE, challenge: true });
    expect(chall.weather === endless.weather && chall.weatherGenerator === endless.weatherGenerator)
      .toBe(false);
  });
});
