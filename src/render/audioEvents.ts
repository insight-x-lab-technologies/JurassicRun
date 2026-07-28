// Módulo PURO (sem phaser/DOM/WebAudio): traduz mudanças de `WorldState` em ids de SFX.
// Diff de escalares guardados em campos primitivos ⇒ alocação-zero por frame (REGRA 3).
// NÃO toca `src/core/`: só LÊ o estado que a simulação já produz.
import type { WorldState } from '@core/sim';
import type { PowerupKind } from '@core/powerup';
import type { SfxId } from '@services/audio';

/** Bitmask dos kinds temporários — comparar efeitos sem alocar Set/array por frame. */
const KIND_BITS: Readonly<Record<PowerupKind, number>> = {
  shield: 1, slowMo: 2, magnet: 4, doubleCoin: 8, extraLife: 16,
};

function effectMask(world: WorldState): number {
  let mask = 0;
  for (const e of world.effects) mask |= KIND_BITS[e.kind] ?? 0;
  return mask;
}

export class AudioEventDetector {
  private food = 0;
  private nearMisses = 0;
  private level = 0;
  private extraLives = 0;
  private effects = 0;
  private lastFlap = false;
  private alive = true;

  /** Rearma o baseline a partir do mundo (chamar na troca de partida). */
  reset(world: WorldState): void {
    this.food = world.food;
    this.nearMisses = world.nearMisses;
    this.level = world.level;
    this.extraLives = world.extraLives;
    this.effects = effectMask(world);
    this.lastFlap = world.lastFlap;
    this.alive = world.alive;
  }

  /** Eventos desde o último poll, escritos em `out` (esvaziado antes). */
  poll(world: WorldState, out: SfxId[]): SfxId[] {
    out.length = 0;
    if (world.lastFlap && !this.lastFlap) out.push('flap');
    if (world.food > this.food) out.push('coin');
    if (world.nearMisses > this.nearMisses) out.push('nearMiss');
    if (world.level > this.level) out.push('levelUp');
    const mask = effectMask(world);
    const gainedEffect = (mask & ~this.effects) !== 0;
    if (gainedEffect || world.extraLives > this.extraLives) out.push('powerup');
    if (world.extraLives < this.extraLives && world.alive) out.push('block');
    if (this.alive && !world.alive) out.push('hit');

    this.lastFlap = world.lastFlap;
    this.food = world.food;
    this.nearMisses = world.nearMisses;
    this.level = world.level;
    this.extraLives = world.extraLives;
    this.effects = mask;
    this.alive = world.alive;
    return out;
  }
}
