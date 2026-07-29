import type { Rng } from '@core/rng';
import type { Hitbox } from '@core/sim/types';
import { aabb, circle, polygon } from '@core/sim/hitbox';

/** Onde a entidade se ancora verticalmente. */
export type Anchor = 'floor' | 'ceiling' | 'floating';

/** Campo lógico visto por um compositor de peças (subconjunto de SpawnConfig). */
export interface SpawnField {
  readonly worldHeight: number;
  readonly yMargin: number;
}

/** Peça de um obstáculo composto: hitbox convexa própria, `dx` relativo ao x do spawn e `y`
 *  CENTRO absoluto (o compositor já ancorou). `tag` default = id do tipo. */
export interface SpawnPiece {
  readonly hitbox: Hitbox;
  readonly dx: number;
  readonly y: number;
  readonly tag?: string;
}

/** Tipo simples: 1 entidade, ancorada por `placeY`. */
export interface SimpleSpawnType {
  readonly id: string;
  readonly anchor: Anchor;
  makeHitbox(rng: Rng): Hitbox;
  readonly makePieces?: undefined;
}

/** Tipo composto: N entidades convexas emitidas no mesmo evento de spawn. Resolve formas
 *  não-convexas (arco com buraco) sem tocar em `collision/` (SAT continua convexo-a-convexo). */
export interface CompositeSpawnType {
  readonly id: string;
  readonly anchor?: undefined;
  readonly makeHitbox?: undefined;
  makePieces(rng: Rng, field: SpawnField): readonly SpawnPiece[];
}

/**
 * Tipo lógico de algo colocável (obstáculo ou coletável): dado puro. `id` = chave do
 * asset-registry e tag da entidade. Tamanhos podem variar via Rng (a arte nunca muda a hitbox).
 */
export type SpawnType = SimpleSpawnType | CompositeSpawnType;

/** Catálogo de obstáculos. Cobre aabb, circle e polygon (formatos variados). */
export const OBSTACLE_CATALOG: readonly SpawnType[] = [
  // Tronco subindo do chão.
  { id: 'obstacle.tree', anchor: 'floor', makeHitbox: (rng) => aabb(6, rng.range(24, 40)) },
  // Cipó pendendo do teto.
  { id: 'obstacle.vine', anchor: 'ceiling', makeHitbox: (rng) => aabb(4, rng.range(20, 34)) },
  // Pedregulho flutuante.
  { id: 'obstacle.boulder', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(10, 18)) },
  // Estalactite: triângulo convexo apontando para baixo (ápice embaixo).
  {
    id: 'obstacle.stalactite',
    anchor: 'ceiling',
    makeHitbox: (rng) => {
      const halfW = rng.range(8, 14);
      const halfH = rng.range(11, 18);
      return polygon([
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: 0, y: halfH },
      ]);
    },
  },
];

/** Catálogo de coletáveis (pássaros-moeda). 1.5: um único tipo basta. */
export const COLLECTIBLE_CATALOG: readonly SpawnType[] = [
  // Pássaro-moeda flutuante (comida). Corpo compacto ⇒ hitbox circular.
  { id: 'bird.coin', anchor: 'floating', makeHitbox: (rng) => circle(rng.range(7, 9)) },
];
