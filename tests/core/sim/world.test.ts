import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, DEFAULT_WORLD_CONFIG, NEAR_MISS_MARGIN } from '@core/sim';

describe('createWorld', () => {
  it('usa os defaults e começa vivo, parado, no centro', () => {
    const w = createWorld();
    expect(w.tick).toBe(0);
    expect(w.distance).toBe(0);
    expect(w.alive).toBe(true);
    expect(w.lastFlap).toBe(false);
    expect(w.worldHeight).toBe(DEFAULT_WORLD_CONFIG.worldHeight);
    expect(w.gravity).toBe(DEFAULT_WORLD_CONFIG.gravity);
    expect(w.flapSpeed).toBe(DEFAULT_WORLD_CONFIG.flapSpeed);
    expect(w.scrollSpeed).toBe(DEFAULT_WORLD_CONFIG.scrollSpeed);
    expect(w.pterodactyl.transform.position).toEqual({ x: 0, y: DEFAULT_WORLD_CONFIG.startY });
    expect(w.pterodactyl.kinematics.velocity).toEqual({ x: 0, y: 0 });
    expect(w.obstacles).toEqual([]);
    expect(w.collectibles).toEqual([]);
  });

  it('respeita config custom (merge parcial)', () => {
    const w = createWorld({ worldHeight: 100, startY: 25, gravity: 1000 });
    expect(w.worldHeight).toBe(100);
    expect(w.pterodactyl.transform.position.y).toBe(25);
    expect(w.gravity).toBe(1000);
    expect(w.scrollSpeed).toBe(DEFAULT_WORLD_CONFIG.scrollSpeed); // não sobrescrito
  });
});

describe('cloneWorld', () => {
  it('produz cópia profunda independente do original', () => {
    const w = createWorld();
    const c = cloneWorld(w);
    expect(c).toEqual(w);
    expect(c).not.toBe(w);

    c.pterodactyl.transform.position.y = 999;
    c.pterodactyl.kinematics.velocity.x = 7;
    c.obstacles.push({
      id: 1, type: 'obstacle', tags: [],
      transform: { position: { x: 0, y: 0 } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: { kind: 'circle', radius: 1 },
    });

    expect(w.pterodactyl.transform.position.y).toBe(DEFAULT_WORLD_CONFIG.startY);
    expect(w.pterodactyl.kinematics.velocity.x).toBe(0);
    expect(w.obstacles).toEqual([]);
  });
});

describe('WorldState.nearMisses', () => {
  it('createWorld inicia nearMisses em 0', () => {
    expect(createWorld().nearMisses).toBe(0);
  });
  it('cloneWorld copia nearMisses', () => {
    const w = createWorld();
    w.nearMisses = 3;
    expect(cloneWorld(w).nearMisses).toBe(3);
  });
  it('NEAR_MISS_MARGIN é um número positivo', () => {
    expect(NEAR_MISS_MARGIN).toBeGreaterThan(0);
  });
});
