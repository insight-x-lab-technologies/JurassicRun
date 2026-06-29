import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { Entity, WorldConfig } from '@core/sim';

// Mundo estático: gravidade/flap zerados ⇒ o dino permanece em startY (controle preciso).
const STATIC: WorldConfig = { worldHeight: 200, startY: 100, gravity: 0, flapSpeed: 0, scrollSpeed: 60 };

function obstacleAt(id: number, x: number, y: number, halfW: number, halfH: number): Entity {
  return {
    id,
    type: 'obstacle',
    tags: ['obstacle.tree'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'aabb', halfW, halfH },
  };
}

function coinAt(id: number, x: number, y: number, radius: number): Entity {
  return {
    id,
    type: 'collectible',
    tags: ['bird.coin'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius },
  };
}

describe('step — colisão dino×obstáculo', () => {
  it('sobrepor um obstáculo mata o dino e congela o estado', () => {
    const w = createWorld(STATIC);
    // Dino aabb(10,8) em (≈0,100); obstáculo grande cobrindo a posição.
    w.obstacles.push(obstacleAt(0, 4, 100, 20, 20));
    step(w, { flap: false });
    expect(w.alive).toBe(false);
    const tickAtDeath = w.tick;
    step(w, { flap: false });
    expect(w.tick).toBe(tickAtDeath); // congelado
  });

  it('obstáculo longe não mata', () => {
    const w = createWorld(STATIC);
    w.obstacles.push(obstacleAt(0, 500, 100, 5, 5));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
  });
});

describe('step — coleta dino×coletável (gatilho de 1.5)', () => {
  it('sobrepor um pássaro-moeda incrementa food e remove o coletável', () => {
    const w = createWorld(STATIC);
    const coin = coinAt(0, 4, 100, 8);
    w.collectibles.push(coin);
    step(w, { flap: false });
    expect(w.food).toBe(1);
    expect(w.collectibles).not.toContain(coin);
  });

  it('coleta apenas os coletáveis sobrepostos (não os distantes)', () => {
    const w = createWorld(STATIC);
    const near = coinAt(0, 4, 100, 8);
    const far = coinAt(1, 500, 100, 8);
    w.collectibles.push(near, far);
    step(w, { flap: false });
    expect(w.food).toBe(1);
    expect(w.collectibles).toContain(far);
    expect(w.collectibles).not.toContain(near);
  });

  it('não coleta após morrer no mesmo step (morte por obstáculo tem precedência)', () => {
    const w = createWorld(STATIC);
    w.obstacles.push(obstacleAt(0, 4, 100, 20, 20));
    w.collectibles.push(coinAt(0, 4, 100, 8));
    step(w, { flap: false });
    expect(w.alive).toBe(false);
    expect(w.food).toBe(0);
  });
});
