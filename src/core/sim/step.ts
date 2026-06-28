import { FIXED_DT } from './constants';
import type { InputFrame, WorldState } from './types';

/**
 * Avança a simulação em exatamente um passo fixo, mutando o mundo in-place.
 * Função pura de (world, input): o mundo carrega seus próprios parâmetros.
 */
export function step(world: WorldState, _input: InputFrame): void {
  world.tick += 1;

  const ptero = world.pterodactyl;
  const vel = ptero.kinematics.velocity;
  const pos = ptero.transform.position;

  // Integração vertical (Euler semi-implícito).
  vel.y += world.gravity * FIXED_DT;
  pos.y += vel.y * FIXED_DT;

  // Scroll horizontal.
  const dx = world.scrollSpeed * FIXED_DT;
  pos.x += dx;
  world.distance += dx;
}
