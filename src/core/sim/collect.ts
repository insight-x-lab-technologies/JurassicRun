import type { Entity, WorldState } from './types';

/**
 * Coleta um pássaro-moeda: incrementa `food` e remove o coletável do mundo. Busca por
 * referência (ids de geradores distintos podem coincidir entre listas). Idempotente: se o
 * coletável não está mais presente, é no-op e retorna false. O GATILHO (colisão) é o item 1.6;
 * multiplicadores/score completos são o item 1.8 (aqui +1 por pássaro).
 */
export function collect(world: WorldState, entity: Entity): boolean {
  const i = world.collectibles.indexOf(entity);
  if (i < 0) return false;
  world.collectibles.splice(i, 1);
  world.food += 1;
  return true;
}
