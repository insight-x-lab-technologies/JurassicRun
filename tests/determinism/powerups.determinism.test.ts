import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { createWorld, step } from '@core/sim';
import type { WorldConfig } from '@core/sim';

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
