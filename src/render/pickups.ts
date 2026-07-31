// Módulo PURO (sem phaser/DOM): deriva "power-ups apanhados" de escalares do WorldState.
// NÃO toca `src/core/` — só LÊ o estado que a simulação já produz (REGRA 1).
// Diff por bitmask em campos primitivos ⇒ alocação-zero por frame (REGRA 3).
import type { WorldState } from '@core/sim';
import type { PowerupKind } from '@core/powerup';

/** Bitmask dos kinds temporários — comparar efeitos sem alocar Set/array por frame. */
export const KIND_BITS: Readonly<Record<PowerupKind, number>> = {
  shield: 1, slowMo: 2, magnet: 4, doubleCoin: 8, extraLife: 16,
};

export function effectMask(world: WorldState): number {
  let mask = 0;
  for (const e of world.effects) mask |= KIND_BITS[e.kind] ?? 0;
  return mask;
}

/**
 * Conta pickups de power-up de UMA partida. Um pickup temporário acende um bit em `effects`;
 * o `extraLife` incrementa `extraLives`. Bloquear um hit derruba `extraLives` — isso NÃO é
 * pickup e não pode contar.
 *
 * Limitação aceita: dois pickups do MESMO kind dentro de um único frame contam 1. O espaçamento
 * de spawn torna isso irrealizável; é a mesma aproximação que o SFX de power-up (9.6) já usa.
 *
 * Limitação aceita (invariante de amostragem): `observe` roda 1× por `advance()`, e `advance`
 * pode consumir vários steps de sim de uma vez (`FixedStepLoop`, teto `MAX_FRAME_TIME` ⇒ até ~15
 * steps). O contador só enxerga o estado NO INSTANTE da observação — um efeito com duração menor
 * que esse teto poderia acender e expirar inteiramente entre duas observações e sumir da
 * contagem. Hoje isso não acontece: toda duração de efeito temporário é bem maior que ~15 steps
 * (`EXTRA_LIFE_GRACE_STEPS` é a mais curta). Se um efeito futuro vier com duração menor, esta
 * classe precisa ser revisitada.
 *
 * Caso especial: `killOrRevive` (core) consome 1 `extraLives` E acende um `shield` de graça no
 * MESMO step (`EXTRA_LIFE_GRACE_STEPS`). Esse escudo é consequência do bloqueio do hit, não um
 * pickup, e não pode contar — mesmo que o bit `shield` suba de 0→1 na mesma observação. Política
 * conservadora: se nesse mesmo instante o jogador também apanhou um escudo de verdade, ele é
 * perdido na contagem (prefere subcontar a inflar o agregado vitalício de troféus).
 */
export class PowerupPickupCounter {
  private effects = 0;
  private extraLives = 0;
  private _count = 0;

  get count(): number {
    return this._count;
  }

  /** Rearma o baseline a partir do mundo e zera a contagem (chamar na troca de partida). */
  reset(world: WorldState): void {
    this.effects = effectMask(world);
    this.extraLives = world.extraLives;
    this._count = 0;
  }

  /** Observa o mundo do step corrente e acumula os pickups desde a última observação. */
  observe(world: WorldState): void {
    const mask = effectMask(world);
    let gained = 0;
    let bits = mask & ~this.effects;
    // `killOrRevive` (core) consome uma vida E acende um `shield` de graça no mesmo step.
    // Esse escudo é consequência do bloqueio, não um pickup — não pode contar.
    if (world.extraLives < this.extraLives) bits &= ~KIND_BITS.shield;
    while (bits !== 0) {
      bits &= bits - 1; // apaga o bit menos significativo aceso
      gained += 1;
    }
    if (world.extraLives > this.extraLives) gained += world.extraLives - this.extraLives;
    this._count += gained;
    this.effects = mask;
    this.extraLives = world.extraLives;
  }
}
