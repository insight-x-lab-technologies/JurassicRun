import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { Entity, WorldState } from '@core/sim';
import { activateEffect, applyMagnet, killOrRevive, isEffectActive } from '@core/powerup';

const CFG = { worldHeight: 600, startY: 300, gravity: 0, flapSpeed: 350, scrollSpeed: 0 };

function obstacleAt(x: number, y: number): Entity {
  return {
    id: 1,
    type: 'obstacle',
    tags: ['obstacle.boulder'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 12 },
  };
}
function coinAt(x: number, y: number): Entity {
  return {
    id: 2,
    type: 'collectible',
    tags: ['bird.coin'],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 8 },
  };
}
function powerupAt(tag: string, x: number, y: number): Entity {
  return {
    id: 3,
    type: 'collectible',
    tags: [tag],
    transform: { position: { x, y } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: { kind: 'circle', radius: 8 },
  };
}

describe('shield', () => {
  it('ignores an otherwise-fatal obstacle overlap while active', () => {
    const w: WorldState = createWorld(CFG);
    activateEffect(w.effects, 'shield', 100);
    w.obstacles.push(obstacleAt(w.pterodactyl.transform.position.x, 300));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
  });
});

describe('extra life', () => {
  it('consumes at most one charge per step even with overlapping obstacles', () => {
    const w: WorldState = createWorld(CFG);
    w.extraLives = 1;
    const px = w.pterodactyl.transform.position.x;
    // Dois obstáculos sobrepondo o dino no MESMO step. O revive concede escudo-de-graça que
    // deve proteger o 2º obstáculo ⇒ só 1 carga consumida (não morre por falta da 2ª).
    w.obstacles.push(obstacleAt(px, 300), obstacleAt(px, 300));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
    expect(w.extraLives).toBe(0);
  });

  it('killOrRevive consumes a charge, keeps alive, and grants a grace shield', () => {
    const w: WorldState = createWorld(CFG);
    w.extraLives = 1;
    killOrRevive(w);
    expect(w.alive).toBe(true);
    expect(w.extraLives).toBe(0);
    expect(isEffectActive(w.effects, 'shield')).toBe(true);
    expect(w.pterodactyl.kinematics.velocity.y).toBe(0);
    expect(w.pterodactyl.transform.position.y).toBe(w.worldHeight / 2);
  });

  it('killOrRevive kills when no charge left', () => {
    const w: WorldState = createWorld(CFG);
    killOrRevive(w);
    expect(w.alive).toBe(false);
  });

  it('a stored extra life saves the dino from an obstacle collision in step', () => {
    const w: WorldState = createWorld(CFG);
    w.extraLives = 1;
    w.obstacles.push(obstacleAt(w.pterodactyl.transform.position.x, 300));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
    expect(w.extraLives).toBe(0);
  });

  it('a stored extra life saves the dino from touching the ground, via step (not a direct killOrRevive call)', () => {
    // Dino nasce perto do topo e cai (gravidade real, sem flap) até tocar o chão.
    const w: WorldState = createWorld({ ...CFG, gravity: 1200, startY: 10 });
    w.extraLives = 1;
    let touchedGround = false;
    for (let i = 0; i < 200 && w.alive; i++) {
      step(w, { flap: false });
      if (w.extraLives === 0) {
        touchedGround = true;
        break;
      }
    }
    expect(touchedGround).toBe(true); // a carga foi de fato consumida pelo chão, não ficou intocada
    expect(w.alive).toBe(true);
    expect(w.extraLives).toBe(0);
    expect(w.pterodactyl.transform.position.y).toBe(w.worldHeight / 2);
  });
});

describe('double coin', () => {
  it('a collected coin yields +2 food while active, +1 otherwise', () => {
    const w: WorldState = createWorld(CFG);
    const px = w.pterodactyl.transform.position.x;
    w.collectibles.push(coinAt(px, 300));
    step(w, { flap: false });
    expect(w.food).toBe(1);
    activateEffect(w.effects, 'doubleCoin', 100);
    w.collectibles.push(coinAt(w.pterodactyl.transform.position.x, 300));
    step(w, { flap: false });
    expect(w.food).toBe(3); // 1 + 2
  });
});

describe('pickup via step (world.powerups, end-to-end)', () => {
  it('shield: overlapping world.powerups entity is collected and activates the effect', () => {
    const w: WorldState = createWorld(CFG);
    const px = w.pterodactyl.transform.position.x;
    const py = w.pterodactyl.transform.position.y;
    w.powerups.push(powerupAt('powerup.shield', px, py));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
    expect(w.powerups.length).toBe(0); // coletado (removido de world.powerups pelo step)
    expect(isEffectActive(w.effects, 'shield')).toBe(true);
  });

  it('extra life: overlapping world.powerups entity is collected and grants a charge', () => {
    const w: WorldState = createWorld(CFG);
    const px = w.pterodactyl.transform.position.x;
    const py = w.pterodactyl.transform.position.y;
    w.powerups.push(powerupAt('powerup.extraLife', px, py));
    step(w, { flap: false });
    expect(w.alive).toBe(true);
    expect(w.powerups.length).toBe(0); // coletado
    expect(w.extraLives).toBe(1);
  });
});

describe('magnet', () => {
  it('pulls an in-radius collectible toward the dino, ignores out-of-radius', () => {
    const w: WorldState = createWorld(CFG);
    const px = w.pterodactyl.transform.position.x;
    const near = coinAt(px + 30, 300); // dentro do raio
    const far = coinAt(px + 500, 300); // fora do raio
    w.collectibles.push(near, far);
    activateEffect(w.effects, 'magnet', 100);
    const nearX0 = near.transform.position.x;
    applyMagnet(w);
    expect(near.transform.position.x).toBeLessThan(nearX0); // puxado para o dino
    expect(far.transform.position.x).toBe(px + 500); // intocado
  });
});
