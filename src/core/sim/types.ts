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
}

/**
 * Estado completo da simulação. `step` é função pura de (WorldState, InputFrame):
 * o mundo carrega seus próprios parâmetros de simulação (alguns ficam dinâmicos em fases futuras).
 */
export interface WorldState {
  tick: number;
  distance: number;
  alive: boolean;
  /** Estado do botão de flap no step anterior (detecção de borda de subida). */
  lastFlap: boolean;
  scrollSpeed: number;
  gravity: number;
  flapSpeed: number;
  worldHeight: number;
  pterodactyl: Pterodactyl;
  obstacles: Entity[];
  collectibles: Entity[];
}
