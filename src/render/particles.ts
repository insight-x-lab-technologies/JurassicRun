/**
 * Partículas de morte (REGRA 1/3): sistema STATELESS puro. Não há array vivo nem
 * spawn/despawn — o estado da partícula `i` no tempo `t` é uma função fechada de (i, t).
 * O índice faz o papel de "aleatoriedade" via ângulo áureo (leque uniforme, sem RNG).
 * Escreve em `out` e devolve `out` (scratch reusável no hot path, alocação-zero).
 */
export const DEATH_PARTICLE_COUNT = 14;

export interface Particle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  visible: boolean;
}

const GOLDEN_ANGLE = 2.399963;
const GRAVITY = 70;

/** Estado da partícula `i` no tempo decorrido `elapsed` (segundos). Offset em unidades de
 *  mundo, relativo ao ponto de impacto. */
export function deathParticleAt(i: number, elapsed: number, out: Particle): Particle {
  const t = Math.max(elapsed, 0);
  const angle = i * GOLDEN_ANGLE;
  const speed = 16 + (i % 5) * 7;
  const life = 0.42 + (i % 3) * 0.14;
  const radius = 0.8 + (i % 2) * 0.7;

  out.x = Math.cos(angle) * speed * t;
  out.y = Math.sin(angle) * speed * t + 0.5 * GRAVITY * t * t;
  out.radius = radius;
  out.alpha = Math.min(1, Math.max(0, 1 - t / life));
  out.visible = t > 0 && t < life;
  return out;
}
