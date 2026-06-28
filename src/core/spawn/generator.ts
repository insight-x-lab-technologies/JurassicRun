import type { Rng } from '@core/rng';
import type { Entity, Hitbox } from '@core/sim/types';
import { boundsOf } from '@core/sim/hitbox';
import { OBSTACLE_CATALOG } from './catalog';
import type { ObstacleAnchor } from './catalog';

/** Parâmetros de geração de obstáculos. Placeholders desta fase; 1.7/Fase 2 afinam. */
export interface SpawnConfig {
  worldHeight: number;
  yMargin: number;
  startX: number;
  gapMin: number;
  gapMax: number;
}

/** Calcula o y (centro) de um obstáculo conforme a âncora, mantendo a hitbox nas margens. */
function placeY(anchor: ObstacleAnchor, hitbox: Hitbox, config: SpawnConfig, rng: Rng): number {
  const b = boundsOf(hitbox);
  const m = config.yMargin;
  switch (anchor) {
    case 'floor':
      return config.worldHeight - m - b.maxY;
    case 'ceiling':
      return m - b.minY;
    case 'floating':
      return rng.range(m - b.minY, config.worldHeight - m - b.maxY);
  }
}

/**
 * Gerador determinístico de obstáculos, keyed por posição x do mundo. Avança um cursor por
 * obstáculo emitido (não por chamada) ⇒ independente de batching/fps. Consome só o Rng dado.
 */
export class SpawnGenerator {
  private readonly rng: Rng;
  private readonly config: SpawnConfig;
  private nextSpawnX: number;
  private nextId: number;

  constructor(rng: Rng, config: SpawnConfig) {
    this.rng = rng;
    this.config = config;
    this.nextSpawnX = config.startX;
    this.nextId = 0;
  }

  /** Empurra em `sink` todo obstáculo com spawnX <= upToX (ordem de x crescente). */
  generateUpTo(upToX: number, sink: Entity[]): void {
    while (this.nextSpawnX <= upToX) {
      const type = this.rng.pick(OBSTACLE_CATALOG);
      const hitbox = type.makeHitbox(this.rng);
      const y = placeY(type.anchor, hitbox, this.config, this.rng);
      sink.push({
        id: this.nextId,
        type: 'obstacle',
        tags: [type.id],
        transform: { position: { x: this.nextSpawnX, y } },
        kinematics: { velocity: { x: 0, y: 0 } },
        hitbox,
      });
      this.nextId += 1;
      this.nextSpawnX += this.rng.range(this.config.gapMin, this.config.gapMax);
    }
  }

  /** Cópia independente (rng clonado + cursor). Para cloneWorld/snapshots. */
  clone(): SpawnGenerator {
    const c = new SpawnGenerator(this.rng.clone(), this.config);
    c.nextSpawnX = this.nextSpawnX;
    c.nextId = this.nextId;
    return c;
  }
}
