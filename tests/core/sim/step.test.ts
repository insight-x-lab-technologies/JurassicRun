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

describe('step — flap (detecção de borda)', () => {
  it('flap na borda de subida zera a queda e impulsiona para cima', () => {
    const w = createWorld();
    step(w, { flap: true });
    // impulso (-flapSpeed) seguido da gravidade do mesmo step
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(-w.flapSpeed + w.gravity * FIXED_DT, 10);
    expect(w.lastFlap).toBe(true);
  });

  it('segurar o botão NÃO re-dispara o flap (só gravidade no 2º step)', () => {
    const w = createWorld();
    step(w, { flap: true });
    const vyAfterFirst = w.pterodactyl.kinematics.velocity.y;
    step(w, { flap: true }); // segurado: sem novo impulso
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(vyAfterFirst + w.gravity * FIXED_DT, 10);
  });

  it('soltar e apertar de novo dispara um novo flap', () => {
    const w = createWorld();
    step(w, { flap: true });
    step(w, { flap: false });
    const vyBefore = w.pterodactyl.kinematics.velocity.y;
    step(w, { flap: true }); // nova borda
    // novo impulso reduz vy em ~flapSpeed (descontada a gravidade do step)
    expect(w.pterodactyl.kinematics.velocity.y).toBeCloseTo(-w.flapSpeed + w.gravity * FIXED_DT, 10);
    expect(w.pterodactyl.kinematics.velocity.y).toBeLessThan(vyBefore);
  });
});
