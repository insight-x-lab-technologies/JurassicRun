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
