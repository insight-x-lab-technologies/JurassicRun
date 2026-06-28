import { FIXED_DT, SPAWN_LOOKAHEAD, CULL_MARGIN } from './constants';
import { boundsOf } from './hitbox';
import type { InputFrame, WorldState } from './types';

/**
 * Avança a simulação em exatamente um passo fixo, mutando o mundo in-place.
 * Função pura de (world, input): o mundo carrega seus próprios parâmetros.
 */
export function step(world: WorldState, input: InputFrame): void {
  if (!world.alive) return; // estado congelado após a morte

  world.tick += 1;

  const ptero = world.pterodactyl;
  const vel = ptero.kinematics.velocity;
  const pos = ptero.transform.position;

  // Flap: impulso na borda de subida do botão (não re-dispara enquanto segurado).
  if (input.flap && !world.lastFlap) {
    vel.y = -world.flapSpeed;
  }
  world.lastFlap = input.flap;

  // Integração vertical (Euler semi-implícito).
  vel.y += world.gravity * FIXED_DT;
  pos.y += vel.y * FIXED_DT;

  // Scroll horizontal.
  const dx = world.scrollSpeed * FIXED_DT;
  pos.x += dx;
  world.distance += dx;

  // Bordas verticais via extents da hitbox (assume AABB no pterodáctilo).
  const halfH = ptero.hitbox.kind === 'aabb' ? ptero.hitbox.halfH : 0;

  // Teto: clamp em y=0.
  if (pos.y - halfH < 0) {
    pos.y = halfH;
    vel.y = 0;
  }

  // Chão: tocar = morte; repousa exatamente sobre o chão.
  if (pos.y + halfH >= world.worldHeight) {
    pos.y = world.worldHeight - halfH;
    world.alive = false;
  }

  // Geração de obstáculos keyed por distância + cull dos ultrapassados (hot path: sem alocação
  // quando nada é emitido/cullado).
  if (world.spawner) {
    world.spawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.obstacles);
    const cullX = pos.x - CULL_MARGIN;
    const obs = world.obstacles;
    while (obs.length > 0 && obs[0]!.transform.position.x + boundsOf(obs[0]!.hitbox).maxX < cullX) {
      obs.shift();
    }
  }
}
