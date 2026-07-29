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
    // flapEvery recalibrado em 9.8 (Task 4): o catálogo de obstáculos cresceu de 4 para 7 tipos
    // (`obstacle.spire`/`gate`/`rock_arch`), o que muda a sequência consumida do fork RNG
    // 'obstacles' e, por consequência, o traçado do curso neste campo de teste legado
    // (worldHeight=600, bem maior que o campo real 320×180). Com `flapEvery=20` o dino agora
    // morre (distance≈535) antes que a 1ª peça do catálogo de power-ups (fork independente,
    // gapMin=600) tenha chance de materializar. `flapEvery=30` sobrevive até distance≈925,
    // reproduzindo a mesma propriedade que o teste sempre quis provar. Mesma técnica de
    // recalibração já usada em economy/weather.determinism.test.ts (9.8, Task 2).
    for (let i = 0; i < 400; i++) step(w, { flap: i % 30 === 0 });
    expect(w.powerups.length).toBeGreaterThan(0);
    const c = cloneWorld(w);
    expect(c.powerups).toEqual(w.powerups);
    expect(c.powerups[0]).not.toBe(w.powerups[0]);
    expect(c.effects).toEqual(w.effects);
    c.extraLives = 5;
    expect(w.extraLives).toBe(0);
  });
});
