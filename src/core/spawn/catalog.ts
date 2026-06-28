import type { Rng } from '@core/rng';
import type { Hitbox } from '@core/sim/types';
import { aabb, circle, polygon } from '@core/sim/hitbox';

/** Onde o obstáculo se ancora verticalmente. */
export type ObstacleAnchor = 'floor' | 'ceiling' | 'floating';

/**
 * Tipo lógico de obstáculo: dado puro. `id` = chave do manifesto/asset-registry e tag da
 * entidade. `makeHitbox` pode variar o tamanho via Rng (a arte nunca muda a hitbox).
 */
export interface ObstacleType {
  readonly id: string;
  readonly anchor: ObstacleAnchor;
  makeHitbox(rng: Rng): Hitbox;
}

/** Catálogo de obstáculos. Cobre aabb, circle e polygon (formatos variados). */
export const OBSTACLE_CATALOG: readonly ObstacleType[] = [
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
