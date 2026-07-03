export type { PowerupKind, ActiveEffect } from './types';
export { activateEffect, tickEffects, isEffectActive, cloneEffects } from './effects';
export { POWERUP_CATALOG, powerupKindForTag, DEFAULT_POWERUP_CONFIG } from './catalog';
export { pickupPowerup, applyMagnet, killOrRevive } from './apply';
export {
  SHIELD_DURATION_STEPS,
  MAGNET_DURATION_STEPS,
  DOUBLE_COIN_DURATION_STEPS,
  EXTRA_LIFE_GRACE_STEPS,
  MAGNET_RADIUS,
  MAGNET_PULL_SPEED,
  DOUBLE_COIN_FOOD_GAIN,
} from './constants';
