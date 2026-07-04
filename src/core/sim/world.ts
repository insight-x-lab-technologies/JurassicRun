import { DEFAULT_WORLD_CONFIG } from './constants';
import { cloneHitbox } from './hitbox';
import type { Entity, WorldConfig, WorldState } from './types';
import { createRng } from '@core/rng';
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG, DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG } from '@core/spawn';
import type { SpawnConfig } from '@core/spawn';
import { difficultyAt } from '@core/difficulty';
import { POWERUP_CATALOG, DEFAULT_POWERUP_CONFIG, cloneEffects } from '@core/powerup';
import { WeatherGenerator } from '@core/weather';

/** Referência de função ESTÁVEL (não realocar por createWorld) p/ igualdade estrutural
 * (toEqual) em testes de determinismo/replay. Mesmo motivo do `noScale` do spawn. */
const OBSTACLE_GAP_SCALE = (x: number): number => difficultyAt(x).gapScale;

function buildSpawner(
  seed: string,
  worldHeight: number,
  override?: Partial<SpawnConfig>,
  gapScale?: (x: number) => number,
): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_SPAWN_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('obstacles'), config, undefined, undefined, gapScale);
}

function buildCollectibleSpawner(seed: string, worldHeight: number, override?: Partial<SpawnConfig>): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_COLLECTIBLE_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('collectibles'), config, COLLECTIBLE_CATALOG, 'collectible');
}

function buildPowerupSpawner(seed: string, worldHeight: number, override?: Partial<SpawnConfig>): SpawnGenerator {
  const config: SpawnConfig = { ...DEFAULT_POWERUP_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork('powerups'), config, POWERUP_CATALOG, 'collectible');
}

function buildWeatherGenerator(seed: string): WeatherGenerator {
  return new WeatherGenerator(createRng(seed).fork('weather'));
}

/** Constrói o mundo inicial a partir de uma config parcial (ausências usam os defaults). */
export function createWorld(config: WorldConfig = {}): WorldState {
  const c = { ...DEFAULT_WORLD_CONFIG, ...config };
  const difficultyEnabled = config.difficulty ?? true;
  const gapScale = difficultyEnabled ? OBSTACLE_GAP_SCALE : undefined;
  const spawner = config.seed === undefined ? null : buildSpawner(config.seed, c.worldHeight, config.spawn, gapScale);
  const collectibleSpawner =
    config.seed === undefined ? null : buildCollectibleSpawner(config.seed, c.worldHeight, config.collectibleSpawn);
  const powerupSpawner =
    config.seed === undefined ? null : buildPowerupSpawner(config.seed, c.worldHeight, config.powerupSpawn);
  const weatherEnabled = config.weather ?? true;
  const weatherGenerator =
    config.seed === undefined || !weatherEnabled ? null : buildWeatherGenerator(config.seed);
  return {
    tick: 0,
    distance: 0,
    food: 0,
    nearMisses: 0,
    score: 0,
    scoreMultiplier: 1,
    alive: true,
    lastFlap: false,
    scrollSpeed: c.scrollSpeed,
    baseScrollSpeed: c.scrollSpeed,
    level: 1,
    difficultyEnabled,
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
    spawner,
    collectibleSpawner,
    powerups: [],
    powerupSpawner,
    effects: [],
    extraLives: 0,
    weather: 'clear',
    weatherGenerator,
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
    food: w.food,
    nearMisses: w.nearMisses,
    score: w.score,
    scoreMultiplier: w.scoreMultiplier,
    alive: w.alive,
    lastFlap: w.lastFlap,
    scrollSpeed: w.scrollSpeed,
    baseScrollSpeed: w.baseScrollSpeed,
    level: w.level,
    difficultyEnabled: w.difficultyEnabled,
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
    spawner: w.spawner ? w.spawner.clone() : null,
    collectibleSpawner: w.collectibleSpawner ? w.collectibleSpawner.clone() : null,
    powerups: w.powerups.map(cloneEntity),
    powerupSpawner: w.powerupSpawner ? w.powerupSpawner.clone() : null,
    effects: cloneEffects(w.effects),
    extraLives: w.extraLives,
    weather: w.weather,
    weatherGenerator: w.weatherGenerator ? w.weatherGenerator.clone() : null,
  };
}
