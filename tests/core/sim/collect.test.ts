import { describe, it, expect } from 'vitest';
import { createWorld, collect } from '@core/sim';
import type { Entity } from '@core/sim';

function fakeCoin(id: number): Entity {
  return {
    id,
    type: 'collectible',
    tags: ['bird.coin'],
    transform: { position: { x: 0, y: 0 } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 8 },
  };
}

describe('collect', () => {
  it('incrementa food e remove o coletável da lista', () => {
    const w = createWorld();
    const coin = fakeCoin(0);
    w.collectibles.push(coin);
    expect(collect(w, coin)).toBe(true);
    expect(w.food).toBe(1);
    expect(w.collectibles).not.toContain(coin);
  });

  it('é idempotente: coletar duas vezes não conta em dobro', () => {
    const w = createWorld();
    const coin = fakeCoin(0);
    w.collectibles.push(coin);
    collect(w, coin);
    expect(collect(w, coin)).toBe(false);
    expect(w.food).toBe(1);
  });

  it('retorna false para entidade ausente (no-op)', () => {
    const w = createWorld();
    expect(collect(w, fakeCoin(9))).toBe(false);
    expect(w.food).toBe(0);
  });
});
