import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';
import type { Entity } from '@core/sim';
import { pickupPowerup, isEffectActive } from '@core/powerup';

const BASE_CONFIG = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200 };
const CONFIG = { ...BASE_CONFIG, seed: 'endless:PWR' };

function makePowerup(id: string, x: number, y: number): Entity {
  return {
    id: 0,
    type: 'collectible',
    tags: [id],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 8 },
  };
}

describe('power-ups in the world', () => {
  it('createWorld seeds the powerup spawner and empty effect state', () => {
    const w = createWorld(CONFIG);
    expect(w.powerups).toEqual([]);
    expect(w.effects).toEqual([]);
    expect(w.extraLives).toBe(0);
    expect(w.powerupSpawner).not.toBeNull();
    const noSeed = createWorld(BASE_CONFIG);
    expect(noSeed.powerupSpawner).toBeNull();
  });

  it('pickupPowerup activates a timed effect and removes the pickup', () => {
    const w = createWorld(CONFIG);
    const p = makePowerup('powerup.shield', 100, 300);
    w.powerups.push(p);
    expect(pickupPowerup(w, p)).toBe(true);
    expect(w.powerups).toHaveLength(0);
    expect(isEffectActive(w.effects, 'shield')).toBe(true);
    expect(pickupPowerup(w, p)).toBe(false); // idempotente
  });

  it('pickupPowerup extraLife increments the charge, not the effects', () => {
    const w = createWorld(CONFIG);
    const p = makePowerup('powerup.extraLife', 100, 300);
    w.powerups.push(p);
    pickupPowerup(w, p);
    expect(w.extraLives).toBe(1);
    expect(w.effects).toEqual([]);
  });

  it('the spawner materializes power-ups keyed by distance and cloneWorld deep-copies them', () => {
    const w = createWorld(CONFIG);
    for (let i = 0; i < 400; i++) step(w, { flap: i % 20 === 0 });
    expect(w.powerups.length).toBeGreaterThan(0);
    const c = cloneWorld(w);
    expect(c.powerups).toEqual(w.powerups);
    expect(c.powerups[0]).not.toBe(w.powerups[0]);
    expect(c.effects).toEqual(w.effects);
    c.extraLives = 5;
    expect(w.extraLives).toBe(0);
  });
});
