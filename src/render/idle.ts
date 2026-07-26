/**
 * Animação idle cosmética de obstáculo (9.4): funções PURAS fechadas no tempo real de render.
 * Molde de `death.ts`/`particles.ts` — sem estado vivo, sem RNG, sem Phaser/DOM, escrevendo em
 * `out` (scratch reusável no hot path ⇒ alocação-zero, REGRA 3). Nada aqui toca `src/core/`:
 * a hitbox lógica é imutável e a colisão não enxerga estes deslocamentos (REGRA 2).
 */
import { renderableFor } from './manifest';
import type { IdleSpec } from './manifest';

/** O relógio cosmético embrulha aqui. Frequências abaixo fecham um número INTEIRO de ciclos
 *  neste período ⇒ o embrulho é invisível (e a precisão do float não degrada com o tempo). */
export const IDLE_WRAP_SECONDS = 100;

const SWAY_HZ = 0.4; // 0,4 × 100 = 40 ciclos exatos
const DRIP_PERIOD = 2.5; // 100 / 2,5 = 40 ciclos exatos
const DRIP_SWELL = 0.4; // fração do ciclo em que a gota engorda parada na ponta
const DRIP_FALL = 26; // queda total, unidades de mundo
const DRIP_RADIUS = 0.9; // raio máximo da gota, unidades de mundo
const DRIP_FADE_FROM = 0.7; // fração da queda a partir da qual a gota desvanece

const TWO_PI = Math.PI * 2;

/** Mantém o relógio cosmético em [0, IDLE_WRAP_SECONDS). */
export function wrapIdleTime(t: number): number {
  const w = t % IDLE_WRAP_SECONDS;
  return w < 0 ? w + IDLE_WRAP_SECONDS : w;
}

/** Fase por instância derivada da posição de mundo (constante por obstáculo — é o mundo que
 *  rola). Cosmética: dessincroniza os obstáculos SEM usar o RNG determinístico do core. */
export function idlePhaseFor(worldX: number): number {
  const p = (worldX * 0.137) % TWO_PI;
  return p < 0 ? p + TWO_PI : p;
}

export interface SwayOffset {
  /** Deslocamento lateral em unidades de mundo; |dx| <= amp SEMPRE (garante a cobertura). */
  dx: number;
}

/** Balanço lateral de um segmento. `t01` = 0 na extremidade presa, 1 na livre; o peso `t01²`
 *  deixa a base cravada e a ponta solta. */
export function swayOffset(
  amp: number,
  t01: number,
  elapsed: number,
  phase: number,
  out: SwayOffset,
): SwayOffset {
  // Extremidade presa (t01<=0) ou amplitude nula: cravada em ZERO exato — sem depender da
  // multiplicação por zero, que herdaria o sinal do seno (-0) e quebraria Object.is(dx, 0).
  if (t01 <= 0 || amp === 0) {
    out.dx = 0;
    return out;
  }
  const t = t01 >= 1 ? 1 : t01;
  out.dx = amp * t * t * Math.sin(TWO_PI * SWAY_HZ * elapsed + phase);
  return out;
}

export interface DripState {
  /** Deslocamento vertical a partir da ponta do obstáculo (unidades de mundo, +y = baixo). */
  y: number;
  radius: number;
  alpha: number;
  visible: boolean;
}

/** Gota da estalactite: engorda parada na ponta, solta, cai acelerando e desvanece. Ciclo
 *  fechado ⇒ estado é função de (elapsed, phase), sem spawn/despawn. */
export function dripAt(elapsed: number, phase: number, out: DripState): DripState {
  const shifted = elapsed + (phase / TWO_PI) * DRIP_PERIOD;
  const cycle = ((shifted % DRIP_PERIOD) + DRIP_PERIOD) % DRIP_PERIOD;
  const p = cycle / DRIP_PERIOD;
  if (p < DRIP_SWELL) {
    const q = p / DRIP_SWELL;
    out.y = 0;
    out.radius = DRIP_RADIUS * q;
    out.alpha = 1;
    out.visible = q > 0;
    return out;
  }
  const q = (p - DRIP_SWELL) / (1 - DRIP_SWELL);
  out.y = DRIP_FALL * q * q;
  out.radius = DRIP_RADIUS;
  out.alpha = q < DRIP_FADE_FROM ? 1 : Math.max(0, (1 - q) / (1 - DRIP_FADE_FROM));
  out.visible = out.alpha > 0;
  return out;
}

/** Cache por typeId: roda 1×/obstáculo/frame no hot path ⇒ não pode alocar (REGRA 3). */
const idleCache = new Map<string, IdleSpec | null>();

/** Movimento idle do tipo lógico, ou null se ele não anima. Memoizado (identidade estável). */
export function idleMotionFor(typeId: string): IdleSpec | null {
  let spec = idleCache.get(typeId);
  if (spec === undefined) {
    const r = renderableFor(typeId);
    spec = r.kind === 'sprite' ? (r.idle ?? null) : null;
    idleCache.set(typeId, spec);
  }
  return spec;
}
