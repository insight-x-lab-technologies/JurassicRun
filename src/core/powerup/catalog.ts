import type { SimpleSpawnType } from '@core/spawn';
import type { SpawnConfig } from '@core/spawn';
import { circle } from '@core/sim/hitbox';
import type { PowerupKind } from './types';

/** Ordem estável dos kinds de power-up (sorteios determinísticos/UI). Espelha POWERUP_CATALOG. */
export const POWERUP_KINDS: readonly PowerupKind[] = Object.freeze([
  'shield', 'extraLife', 'magnet', 'doubleCoin', 'slowMo',
] as const);

/** Catálogo de power-ups (pickups flutuantes de corpo compacto ⇒ hitbox circular). */
export const POWERUP_CATALOG: readonly SimpleSpawnType[] = [
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

/** Cache por kind: uma array congelada por power-up banido ⇒ zero alocação por createWorld
 *  e referência estável para as comparações estruturais dos testes de determinismo. */
const CATALOG_WITHOUT = new Map<PowerupKind, readonly SimpleSpawnType[]>();

/** Catálogo de power-ups sem o `kind` dado (modificador de desafio). Ref memoizada. */
export function powerupCatalogExcluding(kind: PowerupKind): readonly SimpleSpawnType[] {
  const cached = CATALOG_WITHOUT.get(kind);
  if (cached !== undefined) return cached;
  const filtered = Object.freeze(POWERUP_CATALOG.filter((t) => t.id !== `powerup.${kind}`));
  CATALOG_WITHOUT.set(kind, filtered);
  return filtered;
}
