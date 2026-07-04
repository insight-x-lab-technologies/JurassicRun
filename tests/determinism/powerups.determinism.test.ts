import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { createWorld, step } from '@core/sim';
import type { Entity, WorldConfig, WorldState } from '@core/sim';
import { circle } from '@core/sim/hitbox';
import { isEffectActive } from '@core/powerup';

const CONFIG: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: 'endless:PWRDET',
};

/** Roda a sim com N steps por frame (fps-independência): mesma sequência lógica de inputs. */
function runFps(config: WorldConfig, totalSteps: number, flapEvery: number): string {
  const w = createWorld(config);
  for (let i = 0; i < totalSteps; i++) step(w, { flap: i % flapEvery === 0 });
  return hashState(w);
}

describe('power-ups determinism', () => {
  it('same seed + inputs ⇒ identical final state', () => {
    const a = runFps(CONFIG, 1200, 18);
    const b = runFps(CONFIG, 1200, 18);
    expect(a).toBe(b);
  });

  it('power-ups are actually generated (spawn happens)', () => {
    // Sanidade: numa corrida longa, ao menos um power-up é gerado (senão o teste é vazio).
    // Isto NÃO prova que o pickup funciona — só que o spawner materializa entidades
    // `powerup.*` em `world.powerups`. A cobertura end-to-end do caminho de pickup via
    // `step()` (colisão ⇒ remoção + efeito ativado) vive em
    // `tests/core/sim/powerup-effects.test.ts`.
    const w = createWorld(CONFIG);
    let sawSpawn = false;
    for (let i = 0; i < 1200; i++) {
      step(w, { flap: i % 18 === 0 });
      if (w.powerups.length > 0) sawSpawn = true;
    }
    expect(sawSpawn).toBe(true);
  });

  it('distinct seeds ⇒ distinct power-up streams (different final hash)', () => {
    const a = runFps(CONFIG, 800, 18);
    const b = runFps({ ...CONFIG, seed: 'endless:PWRDET2' }, 800, 18);
    expect(a).not.toBe(b);
  });

  it('simulate e uma corrida manual idêntica produzem o mesmo hash', () => {
    // buildTimeline(length, pattern) recebe uma FUNÇÃO (i)=>boolean (ver src/core/replay/timeline.ts).
    const viaSimulate = hashState(simulate(CONFIG, buildTimeline(800, (i) => i % 18 === 0)));
    const viaManual = runFps(CONFIG, 800, 18);
    expect(viaSimulate).toBe(viaManual);
  });
});

describe('power-ups determinism — slow-mo end-to-end (item 3.2)', () => {
  // Coloca manualmente um `powerup.slowMo` bem em cima do dino (mesma posição inicial, raio
  // generoso) para que o pickup aconteça via `step()` já no 1º step — determinístico e
  // não-flaky (não depende do RNG do `powerupSpawner` sortear esse kind especificamente).
  // Mirra `tests/core/powerup/slowmo-pickup.test.ts`, mas passando pelo caminho end-to-end
  // (colisão dino×powerup dentro de `step`), não a chamada direta a `pickupPowerup`.
  function buildWorldWithSlowMoPickup(config: WorldConfig): WorldState {
    const w = createWorld(config);
    const dinoPos = w.pterodactyl.transform.position;
    const pickup: Entity = {
      id: 0,
      type: 'collectible',
      tags: ['powerup.slowMo'],
      transform: { position: { x: dinoPos.x, y: dinoPos.y } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: circle(20),
    };
    w.powerups.push(pickup);
    return w;
  }

  /** Roda com N steps por frame (fps-independência), rastreando se `slowMo` já esteve ativo. */
  function runSlowMo(
    config: WorldConfig,
    totalSteps: number,
    flapEvery: number,
    stepsPerFrame: number,
  ): { world: WorldState; wasActive: boolean } {
    const w = buildWorldWithSlowMoPickup(config);
    let wasActive = false;
    let i = 0;
    while (i < totalSteps) {
      for (let b = 0; b < stepsPerFrame && i < totalSteps; b++, i++) {
        step(w, { flap: i % flapEvery === 0 });
        if (isEffectActive(w.effects, 'slowMo')) wasActive = true;
      }
    }
    return { world: w, wasActive };
  }

  it('o pickup ativa slowMo de fato (guarda de cobertura, senão os testes abaixo seriam vazios)', () => {
    const { world, wasActive } = runSlowMo(CONFIG, 1, 18, 1);
    expect(wasActive).toBe(true);
    expect(isEffectActive(world.effects, 'slowMo')).toBe(true);
  });

  it('reprodutibilidade: mesma seed+timeline com pickup de slowMo ⇒ hashState idêntico', () => {
    const a = runSlowMo(CONFIG, 900, 18, 1);
    const b = runSlowMo(CONFIG, 900, 18, 1);
    expect(a.wasActive).toBe(true);
    expect(b.wasActive).toBe(true);
    expect(hashState(a.world)).toBe(hashState(b.world));
  });

  it('independência de fps: 1, 2 e 5 steps por frame com slowMo ativo ⇒ hashState idêntico', () => {
    const one = runSlowMo(CONFIG, 900, 18, 1);
    const two = runSlowMo(CONFIG, 900, 18, 2);
    const five = runSlowMo(CONFIG, 900, 18, 5);
    expect(one.wasActive).toBe(true);
    expect(two.wasActive).toBe(true);
    expect(five.wasActive).toBe(true);
    const hashOne = hashState(one.world);
    expect(hashState(two.world)).toBe(hashOne);
    expect(hashState(five.world)).toBe(hashOne);
  });
});
