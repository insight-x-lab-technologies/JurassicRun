import type { Entity, WorldState } from '@core/sim';
import { FIXED_DT } from '@core/sim/constants';
import { activateEffect } from './effects';
import { powerupKindForTag } from './catalog';
import {
  SHIELD_DURATION_STEPS,
  MAGNET_DURATION_STEPS,
  DOUBLE_COIN_DURATION_STEPS,
  MAGNET_RADIUS,
  MAGNET_PULL_SPEED,
  EXTRA_LIFE_GRACE_STEPS,
  SLOW_MO_DURATION_STEPS,
} from './constants';

/** Duração (steps) de cada power-up temporário. `extraLife` não é temporário. */
function durationFor(kind: 'shield' | 'magnet' | 'doubleCoin' | 'slowMo'): number {
  switch (kind) {
    case 'shield':
      return SHIELD_DURATION_STEPS;
    case 'magnet':
      return MAGNET_DURATION_STEPS;
    case 'doubleCoin':
      return DOUBLE_COIN_DURATION_STEPS;
    case 'slowMo':
      return SLOW_MO_DURATION_STEPS;
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

/** Ímã: puxa cada coletável dentro de MAGNET_RADIUS em direção ao dino (chamado só quando
 * o efeito 'magnet' está ativo). Alocação-zero: só escalares + Math.sqrt (portável). */
export function applyMagnet(world: WorldState): void {
  const p = world.pterodactyl.transform.position;
  const pullStep = MAGNET_PULL_SPEED * FIXED_DT;
  const cols = world.collectibles;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i]!.transform.position;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0 && dist <= MAGNET_RADIUS) {
      const move = dist < pullStep ? dist : pullStep;
      c.x += (dx / dist) * move;
      c.y += (dy / dist) * move;
    }
  }
}

/** Morte-ou-revive: com vida extra, consome 1 carga, revive ao centro com escudo de graça;
 * senão marca morte. Chamado em todo evento letal (colisão de obstáculo e chão). */
export function killOrRevive(world: WorldState): void {
  if (world.extraLives > 0) {
    world.extraLives -= 1;
    const ptero = world.pterodactyl;
    ptero.transform.position.y = world.worldHeight / 2;
    ptero.kinematics.velocity.y = 0;
    activateEffect(world.effects, 'shield', EXTRA_LIFE_GRACE_STEPS);
    return;
  }
  world.alive = false;
}
