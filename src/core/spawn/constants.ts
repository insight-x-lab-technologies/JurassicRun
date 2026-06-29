import { WORLD_HEIGHT } from '@core/sim/constants';
import type { SpawnConfig } from './generator';

// Placeholders de tuning (unidades de mundo). 1.7/Fase 2 afinam.
export const SPAWN_START_X = 200; // x do primeiro obstáculo (folga inicial p/ o jogador)
export const SPAWN_GAP_MIN = 120; // distância x mínima entre spawns consecutivos
export const SPAWN_GAP_MAX = 220; // distância x máxima
export const SPAWN_Y_MARGIN = 8; // folga das bordas teto/chão

/** Config padrão do gerador (uso standalone/teste; createWorld sobrescreve worldHeight). */
export const DEFAULT_SPAWN_CONFIG: SpawnConfig = Object.freeze({
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: SPAWN_START_X,
  gapMin: SPAWN_GAP_MIN,
  gapMax: SPAWN_GAP_MAX,
});

// Coletáveis: aparecem mais intercalados que obstáculos. Placeholders; 1.7/Fase 2 afinam.
export const COLLECTIBLE_START_X = 150;
export const COLLECTIBLE_GAP_MIN = 90;
export const COLLECTIBLE_GAP_MAX = 160;

/** Config padrão do gerador de coletáveis (createWorld sobrescreve worldHeight). */
export const DEFAULT_COLLECTIBLE_CONFIG: SpawnConfig = Object.freeze({
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: COLLECTIBLE_START_X,
  gapMin: COLLECTIBLE_GAP_MIN,
  gapMax: COLLECTIBLE_GAP_MAX,
});
