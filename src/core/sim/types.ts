import type { SpawnGenerator, SpawnConfig } from '@core/spawn';
import type { ActiveEffect } from '@core/powerup';
import type { WeatherKind, WeatherGenerator } from '@core/weather';

/** Vetor 2D (dados puros). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Hitbox lógica — independente da arte (REGRA 2). Polígono é convexo, pontos relativos ao centro. */
export type Hitbox =
  | { kind: 'aabb'; halfW: number; halfH: number }
  | { kind: 'circle'; radius: number }
  | { kind: 'polygon'; points: readonly Vec2[] };

export interface Transform {
  position: Vec2;
}

export interface Kinematics {
  velocity: Vec2;
}

export type EntityType = 'obstacle' | 'collectible';

/** Entidade genérica para conteúdo procedural (1.4/1.5). SEM dados visuais. */
export interface Entity {
  id: number;
  type: EntityType;
  transform: Transform;
  hitbox: Hitbox;
  kinematics: Kinematics;
  tags: readonly string[];
}

/** O pterodáctilo é um campo nomeado e tipado do mundo. */
export interface Pterodactyl {
  transform: Transform;
  kinematics: Kinematics;
  hitbox: Hitbox;
}

/** Input bruto de um step: estado do botão de flap (segurado ou não). */
export interface InputFrame {
  flap: boolean;
}

/** Configuração opcional para construir um mundo; ausências usam DEFAULT_WORLD_CONFIG. */
export interface WorldConfig {
  worldHeight?: number;
  gravity?: number;
  flapSpeed?: number;
  scrollSpeed?: number;
  startY?: number;
  pterodactylHitbox?: Hitbox;
  /** Seed canônica da partida (de fora do core). Presente ⇒ o mundo gera obstáculos. */
  seed?: string;
  /** Overrides parciais da config de spawn (tuning). */
  spawn?: Partial<SpawnConfig>;
  /** Overrides parciais da config de spawn de coletáveis (tuning). */
  collectibleSpawn?: Partial<SpawnConfig>;
  /** Overrides parciais da config de spawn de power-ups (tuning). */
  powerupSpawn?: Partial<SpawnConfig>;
  /** Liga a curva de dificuldade (velocidade/gaps crescentes). Default true. */
  difficulty?: boolean;
  /** Liga o clima determinístico (afeta a física vertical). Default true. */
  weather?: boolean;
}

/**
 * Estado completo da simulação. `step` é função pura de (WorldState, InputFrame):
 * o mundo carrega seus próprios parâmetros de simulação (alguns ficam dinâmicos em fases futuras).
 */
export interface WorldState {
  tick: number;
  distance: number;
  /** Comida coletada (pássaros-moeda). Pontua via score (item 1.8). */
  food: number;
  /** Near-misses: passar perto de um obstáculo sem colidir. Pontua via score (item 1.8). */
  nearMisses: number;
  /** Pontuação canônica acumulada da partida (float). Distância base + comida + near-miss,
   * escalado por scoreMultiplier, bancado por step. Apresentação faz floor (Fase 2). */
  score: number;
  /** Multiplicador de score ativo (default 1). Mutável em runtime (power-ups da Fase 3). */
  scoreMultiplier: number;
  alive: boolean;
  /** Estado do botão de flap no step anterior (detecção de borda de subida). */
  lastFlap: boolean;
  /** Velocidade de scroll EFETIVA do step atual (base × speedScale; ver baseScrollSpeed). */
  scrollSpeed: number;
  /** Velocidade-base imutável (a `scrollSpeed` efetiva = base × speedScale(distance)). */
  baseScrollSpeed: number;
  /** Nível atual (1-based), derivado da distância. Reinicia a cada partida (distance=0). */
  level: number;
  /** Se a curva de dificuldade está ativa (escala velocidade/gaps). */
  difficultyEnabled: boolean;
  gravity: number;
  flapSpeed: number;
  worldHeight: number;
  pterodactyl: Pterodactyl;
  obstacles: Entity[];
  collectibles: Entity[];
  /** Gerador de obstáculos (null quando o mundo não tem seed). */
  spawner: SpawnGenerator | null;
  /** Gerador de coletáveis (null quando o mundo não tem seed). */
  collectibleSpawner: SpawnGenerator | null;
  /** Pickups de power-up materializados no mundo (item 3.1). */
  powerups: Entity[];
  /** Gerador de power-ups (null quando o mundo não tem seed). */
  powerupSpawner: SpawnGenerator | null;
  /** Efeitos temporários ativos (duração em steps). */
  effects: ActiveEffect[];
  /** Cargas de vida extra acumuladas (não é efeito temporário). */
  extraLives: number;
  /** Clima ativo corrente (afeta a física vertical). Default 'clear'. */
  weather: WeatherKind;
  /** Sequenciador de clima keyed por distância (null sem seed/clima). */
  weatherGenerator: WeatherGenerator | null;
}
