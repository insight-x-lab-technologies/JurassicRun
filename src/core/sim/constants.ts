import { aabb } from './hitbox';
import type { Hitbox, WorldConfig } from './types';

/** Passo fixo da simulação (s). O core nunca recebe dt variável. */
export const FIXED_DT = 1 / 60;

// Constantes de tuning (placeholders; afinadas na Fase 2). Unidades abstratas, +y para baixo.
export const WORLD_HEIGHT = 180;
export const START_Y = WORLD_HEIGHT / 2;
export const GRAVITY = 540; // unidades/s² (para baixo)
export const FLAP_SPEED = 240; // unidades/s (impulso para cima)
export const SCROLL_SPEED = 120; // unidades/s (avanço em +x)
export const PTERODACTYL_HITBOX: Hitbox = aabb(10, 8);

/** Config padrão totalmente preenchida (merge com WorldConfig parcial em createWorld).
 * seed/spawn/collectibleSpawn não têm default fixo e são omitidos intencionalmente. */
export const DEFAULT_WORLD_CONFIG: Required<Omit<WorldConfig, 'seed' | 'spawn' | 'collectibleSpawn'>> = {
  worldHeight: WORLD_HEIGHT,
  gravity: GRAVITY,
  flapSpeed: FLAP_SPEED,
  scrollSpeed: SCROLL_SPEED,
  startY: START_Y,
  pterodactylHitbox: PTERODACTYL_HITBOX,
};

/** Quão à frente do pterodáctilo (em x) o gerador materializa obstáculos. */
export const SPAWN_LOOKAHEAD = 400;
/** Distância atrás do pterodáctilo após a qual obstáculos ultrapassados são removidos. */
export const CULL_MARGIN = 100;

/** Gap vertical máximo (unidades) entre dino e obstáculo ultrapassado para contar near-miss.
 * Placeholder de tuning (Fase 2). */
export const NEAR_MISS_MARGIN = 12;
