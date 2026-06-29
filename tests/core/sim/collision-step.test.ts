import { describe, it, expect } from 'vitest';
import { createWorld, step, NEAR_MISS_MARGIN } from '@core/sim';
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

describe('step — near-miss', () => {
  // Dino aabb(10,8) em y=100 ⇒ topo=92, base=108. STATIC: dx=1/step, gravidade 0.
  // Roda passos suficientes para o dino ultrapassar o obstáculo em x.
  function runPast(obs: Entity, steps = 80): ReturnType<typeof createWorld> {
    const w = createWorld(STATIC);
    w.obstacles.push(obs);
    for (let i = 0; i < steps; i++) step(w, { flap: false });
    return w;
  }

  it('ultrapassar um obstáculo dentro da margem conta 1 near-miss', () => {
    // Obstáculo acima: base do obstáculo em y=82 (halfH=5, centro=77) ⇒ gap = 92-82 = 10 ≤ 12.
    const w = runPast(obstacleAt(0, 30, 77, 3, 5));
    expect(w.alive).toBe(true);
    expect(w.nearMisses).toBe(1);
  });

  it('não conta em dobro em steps subsequentes', () => {
    const w = runPast(obstacleAt(0, 30, 77, 3, 5), 200);
    expect(w.nearMisses).toBe(1);
  });

  it('obstáculo fora da margem não conta near-miss', () => {
    // base do obstáculo em y=65 (centro=60, halfH=5) ⇒ gap = 92-65 = 27 > 12.
    const w = runPast(obstacleAt(0, 30, 60, 3, 5));
    expect(w.alive).toBe(true);
    expect(w.nearMisses).toBe(0);
  });

  it('colisão real não gera near-miss (morte, não "quase")', () => {
    // Obstáculo na altura do dino (y=100) ⇒ colisão ⇒ morte; nunca cruza vivo.
    const w = runPast(obstacleAt(0, 30, 100, 3, 8));
    expect(w.alive).toBe(false);
    expect(w.nearMisses).toBe(0);
  });

  it('margem é respeitada no limite', () => {
    expect(NEAR_MISS_MARGIN).toBe(12);
  });
});
