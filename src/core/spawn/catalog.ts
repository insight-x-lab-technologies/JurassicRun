import type { Rng } from '@core/rng';
import type { Hitbox } from '@core/sim/types';
import { aabb, circle, polygon } from '@core/sim/hitbox';

/** Onde a entidade se ancora verticalmente. */
export type Anchor = 'floor' | 'ceiling' | 'floating';

/**
 * Tipo lógico de algo colocável (obstáculo ou coletável): dado puro. `id` = chave do
 * asset-registry e tag da entidade. `makeHitbox` pode variar o tamanho via Rng (a arte
 * nunca muda a hitbox).
 */
export interface SpawnType {
  readonly id: string;
  readonly anchor: Anchor;
  makeHitbox(rng: Rng): Hitbox;
}

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
