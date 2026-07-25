import { describe, it, expect } from 'vitest';
import { DEATH_PARTICLE_COUNT, deathParticleAt, type Particle } from '@render/particles';

function makeParticle(): Particle {
  return { x: 0, y: 0, radius: 0, alpha: 0, visible: false };
}

describe('DEATH_PARTICLE_COUNT', () => {
  it('é 14', () => {
    expect(DEATH_PARTICLE_COUNT).toBe(14);
  });
});

describe('deathParticleAt', () => {
  it('é pura: mesmo i e mesmo t ⇒ mesmos valores', () => {
    const out1 = makeParticle();
    const out2 = makeParticle();
    const p1 = deathParticleAt(3, 0.2, out1);
    const p2 = deathParticleAt(3, 0.2, out2);
    expect(p1.x).toBeCloseTo(p2.x);
    expect(p1.y).toBeCloseTo(p2.y);
    expect(p1.radius).toBeCloseTo(p2.radius);
    expect(p1.alpha).toBeCloseTo(p2.alpha);
    expect(p1.visible).toBe(p2.visible);
  });

  it('devolve o MESMO objeto passado (alocação-zero)', () => {
    const out = makeParticle();
    const result = deathParticleAt(0, 0.1, out);
    expect(result).toBe(out);
  });

  it('índices diferentes apontam em direções diferentes (leque)', () => {
    const t = 0.1;
    const out = makeParticle();
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < DEATH_PARTICLE_COUNT; i++) {
      deathParticleAt(i, t, out);
      points.push({ x: out.x, y: out.y });
    }
    // Nem todos os pontos são iguais entre si — leque real, não um único raio.
    const distinct = new Set(points.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('y cresce com o tempo (gravidade domina eventualmente, mesmo com componente inicial p/ cima)', () => {
    const out = makeParticle();
    const i = 2; // sin(angle) < 0 nesse índice ⇒ componente vertical inicial "para cima"
    deathParticleAt(i, 0.05, out);
    const yEarly = out.y;
    deathParticleAt(i, 1.5, out); // t grande o bastante p/ o termo quadrático (gravidade) vencer
    const yLate = out.y;
    expect(yLate).toBeGreaterThan(yEarly);
  });

  it('alpha decresce ao longo do tempo até 0, e visible vira false depois da vida', () => {
    const out = makeParticle();
    const i = 0;
    // life(0) = 0.42 + (0 % 3) * 0.14 = 0.42
    deathParticleAt(i, 0.0, out);
    const alphaStart = out.alpha;
    deathParticleAt(i, 0.2, out);
    const alphaMid = out.alpha;
    expect(alphaMid).toBeLessThan(alphaStart);
    deathParticleAt(i, 0.5, out); // > life(0)=0.42
    expect(out.alpha).toBe(0);
    expect(out.visible).toBe(false);
  });

  it('visible é true durante a vida e false antes/depois dela', () => {
    const out = makeParticle();
    const i = 1; // life = 0.42 + (1 % 3) * 0.14 = 0.56
    deathParticleAt(i, 0, out);
    expect(out.visible).toBe(false); // t > 0 é exigido, t=0 não conta
    deathParticleAt(i, 0.1, out);
    expect(out.visible).toBe(true);
    deathParticleAt(i, 0.6, out); // > 0.56
    expect(out.visible).toBe(false);
  });

  it('radius e demais campos são finitos e não-negativos onde aplicável', () => {
    const out = makeParticle();
    for (let i = 0; i < DEATH_PARTICLE_COUNT; i++) {
      deathParticleAt(i, 0.15, out);
      expect(Number.isFinite(out.x)).toBe(true);
      expect(Number.isFinite(out.y)).toBe(true);
      expect(out.radius).toBeGreaterThan(0);
      expect(out.alpha).toBeGreaterThanOrEqual(0);
      expect(out.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('elapsed negativo é tratado como 0 (sem explodir/nan)', () => {
    const out = makeParticle();
    deathParticleAt(0, -1, out);
    expect(out.visible).toBe(false);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
  });
});
