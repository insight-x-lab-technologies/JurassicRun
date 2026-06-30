import { describe, it, expect } from 'vitest';
import { createWorld, FIXED_DT } from '@core/sim';
import type { InputFrame } from '@core/sim';
import { FixedStepLoop } from '@render/loop';
import { NullInputSource } from '@render/input';
import { MAX_FRAME_TIME } from '@render/constants';

/** Mundo alto: o dino não toca o chão em poucos steps ⇒ tick avança sem morte. */
function tallWorld() {
  return createWorld({ worldHeight: 100000 });
}

describe('FixedStepLoop', () => {
  it('advance(FIXED_DT) roda exatamente 1 step e zera o acumulador', () => {
    const loop = new FixedStepLoop(tallWorld(), new NullInputSource());
    expect(loop.advance(FIXED_DT)).toBe(1);
    expect(loop.world.tick).toBe(1);
    expect(loop.alpha).toBeCloseTo(0, 10);
  });

  it('acumula frações até completar um step', () => {
    const loop = new FixedStepLoop(tallWorld(), new NullInputSource());
    expect(loop.advance(FIXED_DT / 2)).toBe(0);
    expect(loop.alpha).toBeCloseTo(0.5, 10);
    expect(loop.advance(FIXED_DT / 2)).toBe(1);
    expect(loop.world.tick).toBe(1);
  });

  it('60 chamadas de advance(FIXED_DT) ⇒ 60 steps (tick=60)', () => {
    const loop = new FixedStepLoop(tallWorld(), new NullInputSource());
    let total = 0;
    for (let i = 0; i < 60; i++) total += loop.advance(FIXED_DT);
    expect(total).toBe(60);
    expect(loop.world.tick).toBe(60);
  });

  it('clampa dt grande (anti spiral-of-death): mesmo nº de steps que MAX_FRAME_TIME', () => {
    const big = new FixedStepLoop(tallWorld(), new NullInputSource()).advance(100);
    const max = new FixedStepLoop(tallWorld(), new NullInputSource()).advance(MAX_FRAME_TIME);
    expect(big).toBe(max);
    expect(big).toBeLessThanOrEqual(Math.ceil(MAX_FRAME_TIME / FIXED_DT));
    expect(big).toBeGreaterThan(0);
  });

  it('alpha fica em [0,1)', () => {
    const loop = new FixedStepLoop(tallWorld(), new NullInputSource());
    loop.advance(FIXED_DT * 2.5);
    expect(loop.alpha).toBeGreaterThanOrEqual(0);
    expect(loop.alpha).toBeLessThan(1);
  });

  it('amostra o InputSource uma vez por step', () => {
    let calls = 0;
    const counting = { sample(): InputFrame { calls++; return { flap: false }; } };
    const loop = new FixedStepLoop(tallWorld(), counting);
    const steps = loop.advance(FIXED_DT * 5);
    expect(calls).toBe(steps);
    expect(calls).toBe(5);
  });

  it('renderX/renderY ficam entre prev e curr; sem salto no início (prev=curr)', () => {
    const world = tallWorld();
    const loop = new FixedStepLoop(world, new NullInputSource());
    // Antes de qualquer step: render == posição inicial.
    expect(loop.renderX).toBe(world.pterodactyl.transform.position.x);
    expect(loop.renderY).toBe(world.pterodactyl.transform.position.y);
    // Avança 1 step + meia fração: renderX entre prev (após o step) e curr.
    loop.advance(FIXED_DT * 1.5);
    const currX = world.pterodactyl.transform.position.x;
    expect(loop.renderX).toBeLessThanOrEqual(currX);
  });
});
