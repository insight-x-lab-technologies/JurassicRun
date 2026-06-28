import { describe, it, expect } from 'vitest';
import { createWorld, step, FIXED_DT } from '@core/sim';

const NO_FLAP = { flap: false };

describe('step — integração base', () => {
  it('tick incrementa de 1 por step', () => {
    const w = createWorld();
    step(w, NO_FLAP);
    expect(w.tick).toBe(1);
    step(w, NO_FLAP);
    expect(w.tick).toBe(2);
  });

  it('gravidade aumenta velocity.y e faz o pterodáctilo cair (y cresce)', () => {
    const w = createWorld();
    const y0 = w.pterodactyl.transform.position.y;
    step(w, NO_FLAP);
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(w.gravity * FIXED_DT, 10);
    expect(w.pterodactyl.transform.position.y).toBeGreaterThan(y0);
  });

  it('scroll avança x e distance em scrollSpeed*FIXED_DT por step', () => {
    const w = createWorld();
    const dx = w.scrollSpeed * FIXED_DT;
    step(w, NO_FLAP);
    expect(w.pterodactyl.transform.position.x).toBeCloseTo(dx, 10);
    expect(w.distance).toBeCloseTo(dx, 10);
    step(w, NO_FLAP);
    expect(w.distance).toBeCloseTo(2 * dx, 10);
  });
});
