import { describe, it, expect } from 'vitest';
import { DEATH_ANIM_SECONDS, deathVisual, type DeathVisual } from '@render/death';

function freshVisual(): DeathVisual {
  return { progress: -1, rotation: -1, dropFactor: -1, shakeX: -1, shakeY: -1, flash: -1 };
}

describe('deathVisual', () => {
  it('devolve o MESMO objeto passado (alocação-zero)', () => {
    const out = freshVisual();
    const result = deathVisual(0.3, out);
    expect(result).toBe(out);
  });

  it('clampa o progresso em [0,1]', () => {
    const out = freshVisual();
    deathVisual(-5, out);
    expect(out.progress).toBe(0);

    deathVisual(0, out);
    expect(out.progress).toBe(0);

    deathVisual(DEATH_ANIM_SECONDS, out);
    expect(out.progress).toBe(1);

    deathVisual(DEATH_ANIM_SECONDS * 10, out);
    expect(out.progress).toBe(1);
  });

  it('shake é EXATAMENTE 0 quando p >= 1', () => {
    const out = freshVisual();
    deathVisual(DEATH_ANIM_SECONDS, out);
    expect(out.shakeX).toBe(0);
    expect(out.shakeY).toBe(0);

    deathVisual(DEATH_ANIM_SECONDS * 3, out);
    expect(out.shakeX).toBe(0);
    expect(out.shakeY).toBe(0);
  });

  it('dropFactor é negativo no começo (pop) e vale 1 (±1e-9) em p=1', () => {
    const out = freshVisual();
    deathVisual(DEATH_ANIM_SECONDS * 0.05, out);
    expect(out.dropFactor).toBeLessThan(0);

    deathVisual(DEATH_ANIM_SECONDS, out);
    expect(out.dropFactor).toBeCloseTo(1, 9);
  });

  it('rotação é estritamente crescente e ≈ 2π·1.25 no fim', () => {
    const out = freshVisual();
    let previous = -Infinity;
    let last = -Infinity;
    for (const p of [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1]) {
      deathVisual(DEATH_ANIM_SECONDS * p, out);
      expect(out.rotation).toBeGreaterThan(previous);
      previous = out.rotation;
      last = out.rotation;
    }
    expect(last).toBeCloseTo(2 * Math.PI * 1.25, 9);
  });

  it('flash é 1 em t=0 e 0 a partir de 0,12s', () => {
    const out = freshVisual();
    deathVisual(0, out);
    expect(out.flash).toBe(1);

    deathVisual(0.12, out);
    expect(out.flash).toBe(0);

    deathVisual(0.5, out);
    expect(out.flash).toBe(0);
  });

  it('elapsed <= 0 fica em repouso (progress/rotation/dropFactor), exceto flash = 1', () => {
    const out = freshVisual();
    deathVisual(0, out);
    expect(out.progress).toBe(0);
    expect(out.rotation).toBe(0);
    expect(out.dropFactor).toBe(0);
    expect(out.flash).toBe(1);

    deathVisual(-1, out);
    expect(out.progress).toBe(0);
    expect(out.rotation).toBe(0);
    expect(out.dropFactor).toBe(0);
    expect(out.flash).toBe(1);
  });
});
