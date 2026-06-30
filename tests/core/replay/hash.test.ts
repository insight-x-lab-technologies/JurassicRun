import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { WorldConfig, WorldState } from '@core/sim';
import { hashState } from '@core/replay';

const CONFIG: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: 'endless:HASHTEST',
};

function advanced(n: number, flapEvery = 6): WorldState {
  const w = createWorld(CONFIG);
  for (let i = 0; i < n; i++) step(w, { flap: i % flapEvery === 0 });
  return w;
}

describe('hashState — formato', () => {
  it('retorna 32 chars hexadecimais', () => {
    const h = hashState(createWorld(CONFIG));
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('hashState — determinismo', () => {
  it('mesmo estado ⇒ mesmo hash', () => {
    expect(hashState(advanced(400))).toBe(hashState(advanced(400)));
  });
});

describe('hashState — sensibilidade', () => {
  it('detecta mudança em escalar inteiro (food)', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    b.food += 1;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta mudança float minúscula (distance += 1e-9)', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    b.distance += 1e-9;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta mudança numa posição de obstáculo', () => {
    const a = advanced(400);
    const b = advanced(400);
    expect(a.obstacles.length).toBeGreaterThan(0);
    b.obstacles[0]!.transform.position.x += 1e-6;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta flag alive virada', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    b.alive = !b.alive;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('detecta tag adicionada num obstáculo', () => {
    const a = advanced(400);
    const b = advanced(400);
    b.obstacles[0]!.tags = [...b.obstacles[0]!.tags, 'x'];
    expect(hashState(a)).not.toBe(hashState(b));
  });
});

describe('hashState — normalização de -0', () => {
  it('+0 e -0 produzem o mesmo hash', () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    a.distance = 0;
    b.distance = -0;
    expect(hashState(a)).toBe(hashState(b));
  });
});
