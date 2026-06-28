import { describe, it, expect } from 'vitest';
import { aabb, circle, cloneHitbox, polygon, boundsOf } from '@core/sim';
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

describe('polygon', () => {
  it('copia os pontos (não compartilha referência)', () => {
    const pts = [{ x: 0, y: -5 }, { x: 4, y: 5 }, { x: -4, y: 5 }];
    const h = polygon(pts);
    expect(h).toEqual({ kind: 'polygon', points: pts });
    if (h.kind === 'polygon') expect(h.points).not.toBe(pts);
  });
});

describe('boundsOf', () => {
  it('aabb: ±half em cada eixo', () => {
    expect(boundsOf(aabb(6, 8))).toEqual({ minX: -6, maxX: 6, minY: -8, maxY: 8 });
  });
  it('circle: ±radius em cada eixo', () => {
    expect(boundsOf(circle(10))).toEqual({ minX: -10, maxX: 10, minY: -10, maxY: 10 });
  });
  it('polygon: min/max dos pontos', () => {
    const h = polygon([{ x: -4, y: -3 }, { x: 6, y: -3 }, { x: 0, y: 9 }]);
    expect(boundsOf(h)).toEqual({ minX: -4, maxX: 6, minY: -3, maxY: 9 });
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
