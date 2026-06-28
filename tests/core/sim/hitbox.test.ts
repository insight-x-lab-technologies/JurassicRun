import { describe, it, expect } from 'vitest';
import { aabb, circle, cloneHitbox } from '@core/sim';
import { FIXED_DT, DEFAULT_WORLD_CONFIG } from '@core/sim';

describe('hitbox — construtores de dados', () => {
  it('aabb produz união discriminada correta', () => {
    expect(aabb(10, 8)).toEqual({ kind: 'aabb', halfW: 10, halfH: 8 });
  });

  it('circle produz união discriminada correta', () => {
    expect(circle(5)).toEqual({ kind: 'circle', radius: 5 });
  });

  it('cloneHitbox copia em profundidade (polígono não compartilha referência)', () => {
    const poly = { kind: 'polygon' as const, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] };
    const copy = cloneHitbox(poly);
    expect(copy).toEqual(poly);
    expect(copy).not.toBe(poly);
    if (copy.kind === 'polygon') {
      expect(copy.points).not.toBe(poly.points);
      expect(copy.points[0]).not.toBe(poly.points[0]);
    }
  });
});

describe('constantes de simulação', () => {
  it('FIXED_DT é 1/60', () => {
    expect(FIXED_DT).toBe(1 / 60);
  });

  it('DEFAULT_WORLD_CONFIG tem todos os campos preenchidos e coerentes', () => {
    expect(DEFAULT_WORLD_CONFIG.worldHeight).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.startY).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.startY).toBeLessThan(DEFAULT_WORLD_CONFIG.worldHeight);
    expect(DEFAULT_WORLD_CONFIG.gravity).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.flapSpeed).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.scrollSpeed).toBeGreaterThan(0);
    expect(DEFAULT_WORLD_CONFIG.pterodactylHitbox.kind).toBe('aabb');
  });
});
