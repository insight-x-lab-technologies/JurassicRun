import type { Rng } from '@core/rng';
import type { Entity, EntityType, Hitbox } from '@core/sim/types';
import { boundsOf } from '@core/sim/hitbox';
import { OBSTACLE_CATALOG } from './catalog';
import type { Anchor, SpawnType } from './catalog';

/** Parâmetros de geração. Dados puros (sem comportamento). 1.7/Fase 2 afinam tuning. */
export interface SpawnConfig {
  readonly worldHeight: number;
  readonly yMargin: number;
  readonly startX: number;
  readonly gapMin: number;
  readonly gapMax: number;
}

/** Escala de gap neutra (sem dificuldade). Referência estável para comparação de estado. */
function noScale(_x: number): number {
  return 1;
}

/** Calcula o y (centro) de uma entidade conforme a âncora, mantendo a hitbox nas margens. */
function placeY(anchor: Anchor, hitbox: Hitbox, config: SpawnConfig, rng: Rng): number {
  const b = boundsOf(hitbox);
  const m = config.yMargin;
  switch (anchor) {
    case 'floor':
      return config.worldHeight - m - b.maxY;
    case 'ceiling':
      return m - b.minY;
    case 'floating': {
      const lo = m - b.minY;
      const hi = config.worldHeight - m - b.maxY;
      // Sempre consome exatamente 1 saque (estabilidade do stream); idêntico a
      // rng.range(lo, hi) quando cabe; centraliza quando a hitbox não cabe nas margens.
      const t = rng.next();
      return hi > lo ? lo + t * (hi - lo) : (lo + hi) / 2;
    }
  }
}

/**
 * Gerador determinístico de entidades (obstáculos ou coletáveis), keyed por posição x do
 * mundo. Avança um cursor por entidade emitida (não por chamada) ⇒ independente de
 * batching/fps. Consome só o Rng dado.
 */
export class SpawnGenerator {
  private readonly rng: Rng;
  private readonly config: SpawnConfig;
  private readonly catalog: readonly SpawnType[];
  private readonly entityType: EntityType;
  private readonly gapScale: (x: number) => number;
  private nextSpawnX: number;
  private nextId: number;

  constructor(
    rng: Rng,
    config: SpawnConfig,
    catalog: readonly SpawnType[] = OBSTACLE_CATALOG,
    entityType: EntityType = 'obstacle',
    gapScale: (x: number) => number = noScale,
  ) {
    this.rng = rng;
    this.config = config;
    this.catalog = catalog;
    this.entityType = entityType;
    this.gapScale = gapScale;
    this.nextSpawnX = config.startX;
    this.nextId = 0;
  }

  /** Empurra em `sink` toda entidade com spawnX <= upToX (ordem de x crescente). */
  generateUpTo(upToX: number, sink: Entity[]): void {
    while (this.nextSpawnX <= upToX) {
      const type = this.rng.pick(this.catalog);
      const hitbox = type.makeHitbox(this.rng);
      const y = placeY(type.anchor, hitbox, this.config, this.rng);
      sink.push({
        id: this.nextId,
        type: this.entityType,
        tags: [type.id],
        transform: { position: { x: this.nextSpawnX, y } },
        kinematics: { velocity: { x: 0, y: 0 } },
        hitbox,
      });
      this.nextId += 1;
      const s = this.gapScale(this.nextSpawnX);
      this.nextSpawnX += this.rng.range(this.config.gapMin * s, this.config.gapMax * s);
    }
  }

  /** Cópia independente (rng clonado + cursor). Para cloneWorld/snapshots. */
  clone(): SpawnGenerator {
    const c = new SpawnGenerator(
      this.rng.clone(),
      this.config,
      this.catalog,
      this.entityType,
      this.gapScale,
    );
    c.nextSpawnX = this.nextSpawnX;
    c.nextId = this.nextId;
    return c;
  }
}
