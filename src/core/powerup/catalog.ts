import type { SpawnType } from '@core/spawn';
import type { SpawnConfig } from '@core/spawn';
import { circle } from '@core/sim/hitbox';
import type { PowerupKind } from './types';

/** Catálogo de power-ups (pickups flutuantes de corpo compacto ⇒ hitbox circular). */
export const POWERUP_CATALOG: readonly SpawnType[] = [
  { id: 'powerup.shield', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: 'powerup.extraLife', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: 'powerup.magnet', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: 'powerup.doubleCoin', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: 'powerup.slowMo', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
];

/** Tag (id do tipo) → kind do power-up. Tabela explícita (não parsing). */
const KIND_BY_TAG: Readonly<Record<string, PowerupKind>> = {
  'powerup.shield': 'shield',
  'powerup.extraLife': 'extraLife',
  'powerup.magnet': 'magnet',
  'powerup.doubleCoin': 'doubleCoin',
  'powerup.slowMo': 'slowMo',
};

export function powerupKindForTag(tag: string): PowerupKind | null {
  return KIND_BY_TAG[tag] ?? null;
}

/** Spawn de power-ups: raros ⇒ gaps grandes. Placeholders de tuning. */
export const DEFAULT_POWERUP_CONFIG: SpawnConfig = Object.freeze({
  worldHeight: 0, // sobrescrito por createWorld
  yMargin: 24,
  startX: 320,
  gapMin: 600,
  gapMax: 1000,
});
