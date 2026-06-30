import { createWorld, step } from '@core/sim';
import type { WorldConfig, WorldState } from '@core/sim';
import type { InputTimeline } from './timeline';

/**
 * Roda a simulação headless do início ao fim a partir de `config` (com seed) e uma timeline
 * de inputs, devolvendo o `WorldState` final. Pura: toda aleatoriedade vem de `config.seed`
 * e o tempo é o passo fixo da simulação. fps-independente (garantido por `step`).
 */
export function simulate(config: WorldConfig, timeline: InputTimeline): WorldState {
  const world = createWorld(config);
  for (const frame of timeline) step(world, frame);
  return world;
}
