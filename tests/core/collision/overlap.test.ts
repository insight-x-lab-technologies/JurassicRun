import { describe, it, expect } from 'vitest';
import { overlaps } from '@core/collision';
import { aabb, circle, polygon } from '@core/sim/hitbox';
import type { Vec2 } from '@core/sim/types';

const O: Vec2 = { x: 0, y: 0 };

describe('overlaps — aabb × aabb', () => {
  it('sobrepostos', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 12, y: 0 })).toBe(true);
  });
  it('separados em x', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 16, y: 0 })).toBe(false);
  });
  it('separados em y', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 0, y: 20 })).toBe(false);
  });
  it('encostando na borda conta como sobreposição', () => {
    expect(overlaps(aabb(10, 8), O, aabb(5, 5), { x: 15, y: 0 })).toBe(true);
  });
});

describe('overlaps — circle × circle', () => {
  it('sobrepostos', () => {
    expect(overlaps(circle(5), O, circle(5), { x: 8, y: 0 })).toBe(true);
  });
  it('separados', () => {
    expect(overlaps(circle(5), O, circle(5), { x: 11, y: 0 })).toBe(false);
  });
  it('tangentes contam como sobreposição', () => {
    expect(overlaps(circle(5), O, circle(5), { x: 10, y: 0 })).toBe(true);
  });
});

describe('overlaps — aabb × circle (qualquer ordem)', () => {
  it('círculo dentro do aabb', () => {
    expect(overlaps(aabb(10, 8), O, circle(3), { x: 2, y: 1 })).toBe(true);
  });
  it('círculo encostando num canto', () => {
    // canto do aabb em (10,8); círculo raio 5 centrado a 3-4-5 do canto
    expect(overlaps(aabb(10, 8), O, circle(5), { x: 13, y: 12 })).toBe(true);
  });
  it('círculo fora, perto do canto mas sem tocar', () => {
    expect(overlaps(circle(2), { x: 14, y: 12 }, aabb(10, 8), O)).toBe(false);
  });
  it('ordem invertida dá o mesmo resultado', () => {
    expect(overlaps(circle(3), { x: 2, y: 1 }, aabb(10, 8), O)).toBe(true);
  });
});

describe('overlaps — polígono (SAT)', () => {
  // triângulo apontando para baixo (estalactite), ápice em y=+halfH
  const tri = polygon([
    { x: -10, y: -12 },
    { x: 10, y: -12 },
    { x: 0, y: 12 },
  ]);
  it('polígono × aabb sobrepostos', () => {
    expect(overlaps(tri, O, aabb(6, 6), { x: 0, y: 14 })).toBe(true);
  });
  it('polígono × aabb separados (ao lado do ápice)', () => {
    expect(overlaps(tri, O, aabb(2, 2), { x: 9, y: 14 })).toBe(false);
  });
  it('polígono × círculo sobrepostos (perto do ápice)', () => {
    expect(overlaps(tri, O, circle(4), { x: 0, y: 15 })).toBe(true);
  });
  it('polígono × círculo separados', () => {
    expect(overlaps(tri, O, circle(3), { x: 20, y: 0 })).toBe(false);
  });
  it('polígono × polígono sobrepostos', () => {
    expect(overlaps(tri, O, tri, { x: 4, y: 0 })).toBe(true);
  });
  it('polígono × polígono separados', () => {
    expect(overlaps(tri, O, tri, { x: 40, y: 0 })).toBe(false);
  });
  it('simétrico: inverter os argumentos não muda o resultado', () => {
    const a = overlaps(tri, O, aabb(6, 6), { x: 0, y: 14 });
    const b = overlaps(aabb(6, 6), { x: 0, y: 14 }, tri, O);
    expect(a).toBe(b);
  });
});
