import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';

const NO_FLAP = { flap: false };

/** half-extent vertical da hitbox AABB do pterodáctilo (assume kind 'aabb'). */
function halfH(w: ReturnType<typeof createWorld>): number {
  const hb = w.pterodactyl.hitbox;
  if (hb.kind !== 'aabb') throw new Error('teste assume hitbox aabb');
  return hb.halfH;
}

describe('step — teto (clamp)', () => {
  it('não deixa o topo da hitbox passar de y=0; zera a velocidade', () => {
    // mundo alto o suficiente + flap forte para subir rápido contra o teto
    const w = createWorld({ worldHeight: 180, startY: 20, flapSpeed: 5000 });
    step(w, { flap: true });
    expect(w.pterodactyl.transform.position.y - halfH(w)).toBeGreaterThanOrEqual(0);
    expect(w.pterodactyl.transform.position.y).toBe(halfH(w)); // repousa no teto
    expect(w.pterodactyl.kinematics.velocity.y).toBe(0);
    expect(w.alive).toBe(true); // teto não mata
  });
});

describe('step — chão (morte)', () => {
  it('tocar o chão com a base da hitbox mata e repousa no chão', () => {
    const w = createWorld({ worldHeight: 60, startY: 30 });
    let steps = 0;
    while (w.alive && steps < 1000) {
      step(w, NO_FLAP);
      steps++;
    }
    expect(w.alive).toBe(false);
    expect(w.pterodactyl.transform.position.y + halfH(w)).toBeCloseTo(w.worldHeight, 6);
  });

  it('step em mundo morto é no-op (estado congelado, tick não avança)', () => {
    const w = createWorld({ worldHeight: 60, startY: 30 });
    while (w.alive) step(w, NO_FLAP);
    const snapshot = cloneWorld(w);
    step(w, { flap: true });
    step(w, NO_FLAP);
    expect(w).toEqual(snapshot);
  });
});
