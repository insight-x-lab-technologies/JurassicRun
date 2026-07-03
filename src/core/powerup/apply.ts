import type { Entity, WorldState } from '@core/sim';
import { activateEffect } from './effects';
import { powerupKindForTag } from './catalog';
import { SHIELD_DURATION_STEPS, MAGNET_DURATION_STEPS, DOUBLE_COIN_DURATION_STEPS } from './constants';

/** Duração (steps) de cada power-up temporário. `extraLife` não é temporário. */
function durationFor(kind: 'shield' | 'magnet' | 'doubleCoin'): number {
  switch (kind) {
    case 'shield':
      return SHIELD_DURATION_STEPS;
    case 'magnet':
      return MAGNET_DURATION_STEPS;
    case 'doubleCoin':
      return DOUBLE_COIN_DURATION_STEPS;
  }
}

/**
 * Coleta um power-up: remove do mundo e aplica seu efeito. Temporário ⇒ ativa em `effects`;
 * `extraLife` (carga) ⇒ incrementa `extraLives`. Idempotente (no-op se ausente).
 */
export function pickupPowerup(world: WorldState, entity: Entity): boolean {
  const i = world.powerups.indexOf(entity);
  if (i < 0) return false;
  const kind = powerupKindForTag(entity.tags[0] ?? '');
  world.powerups.splice(i, 1);
  if (kind === null) return true; // tag desconhecida: consome sem efeito
  if (kind === 'extraLife') {
    world.extraLives += 1;
  } else {
    activateEffect(world.effects, kind, durationFor(kind));
  }
  return true;
}
