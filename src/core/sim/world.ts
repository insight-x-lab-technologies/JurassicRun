import { DEFAULT_WORLD_CONFIG } from './constants';
import { cloneHitbox } from './hitbox';
import type { Entity, WorldConfig, WorldState } from './types';

/** Constrói o mundo inicial a partir de uma config parcial (ausências usam os defaults). */
export function createWorld(config: WorldConfig = {}): WorldState {
  const c = { ...DEFAULT_WORLD_CONFIG, ...config };
  return {
    tick: 0,
    distance: 0,
    alive: true,
    lastFlap: false,
    scrollSpeed: c.scrollSpeed,
    gravity: c.gravity,
    flapSpeed: c.flapSpeed,
    worldHeight: c.worldHeight,
    pterodactyl: {
      transform: { position: { x: 0, y: c.startY } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: cloneHitbox(c.pterodactylHitbox),
    },
    obstacles: [],
    collectibles: [],
  };
}

function cloneEntity(e: Entity): Entity {
  return {
    id: e.id,
    type: e.type,
    tags: [...e.tags],
    transform: { position: { x: e.transform.position.x, y: e.transform.position.y } },
    kinematics: { velocity: { x: e.kinematics.velocity.x, y: e.kinematics.velocity.y } },
    hitbox: cloneHitbox(e.hitbox),
  };
}

/** Cópia profunda do mundo (snapshots para testes/replay/render). */
export function cloneWorld(w: WorldState): WorldState {
  return {
    tick: w.tick,
    distance: w.distance,
    alive: w.alive,
    lastFlap: w.lastFlap,
    scrollSpeed: w.scrollSpeed,
    gravity: w.gravity,
    flapSpeed: w.flapSpeed,
    worldHeight: w.worldHeight,
    pterodactyl: {
      transform: { position: { x: w.pterodactyl.transform.position.x, y: w.pterodactyl.transform.position.y } },
      kinematics: { velocity: { x: w.pterodactyl.kinematics.velocity.x, y: w.pterodactyl.kinematics.velocity.y } },
      hitbox: cloneHitbox(w.pterodactyl.hitbox),
    },
    obstacles: w.obstacles.map(cloneEntity),
    collectibles: w.collectibles.map(cloneEntity),
  };
}
