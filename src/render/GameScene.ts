import * as Phaser from 'phaser';
import { boundsOf } from '@core/sim';
import type { Entity, Hitbox, WorldState } from '@core/sim';
import { FixedStepLoop } from './loop';
import { renderableFor, DINO_TYPE_ID } from './manifest';
import type { InputSource } from './input';
import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  DINO_SCREEN_X,
  GROUND_COLOR,
  CEILING_COLOR,
  GROUND_THICKNESS,
} from './constants';

/** Renderiza o WorldState lido do core. Não altera a simulação (REGRA 1). */
export class GameScene extends Phaser.Scene {
  private readonly world: WorldState;
  private readonly inputSource: InputSource;
  private loop!: FixedStepLoop;
  private gfx!: Phaser.GameObjects.Graphics;

  constructor(world: WorldState, input: InputSource) {
    super('GameScene');
    this.world = world;
    this.inputSource = input;
  }

  create(): void {
    // Cenário fixo (scrollFactor 0): faixas de teto e chão. Parallax real é 2.3.
    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillStyle(CEILING_COLOR, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, GROUND_THICKNESS);
    bg.fillStyle(GROUND_COLOR, 1);
    bg.fillRect(0, VIEW_HEIGHT - GROUND_THICKNESS, VIEW_WIDTH, GROUND_THICKNESS);

    // Graphics do mundo (scrollFactor 1 ⇒ acompanha a câmera).
    this.gfx = this.add.graphics();
    this.loop = new FixedStepLoop(this.world, this.inputSource);
  }

  override update(_time: number, deltaMs: number): void {
    this.loop.advance(deltaMs / 1000);

    // Câmera segue o dino interpolado; vertical não scrolla (o mundo cabe na altura).
    this.cameras.main.scrollX = this.loop.renderX - DINO_SCREEN_X;

    const g = this.gfx;
    g.clear();
    for (const o of this.world.obstacles) this.drawEntity(g, o);
    for (const c of this.world.collectibles) this.drawEntity(g, c);
    this.drawPrimitive(
      g,
      DINO_TYPE_ID,
      this.world.pterodactyl.hitbox,
      this.loop.renderX,
      this.loop.renderY,
    );
  }

  private drawEntity(g: Phaser.GameObjects.Graphics, e: Entity): void {
    const typeId = e.tags[0] ?? '';
    this.drawPrimitive(g, typeId, e.hitbox, e.transform.position.x, e.transform.position.y);
  }

  /** Desenha a geometria da hitbox (ou triângulo cosmético) na cor do manifesto. */
  private drawPrimitive(
    g: Phaser.GameObjects.Graphics,
    typeId: string,
    hitbox: Hitbox,
    cx: number,
    cy: number,
  ): void {
    const r = renderableFor(typeId);
    if (r.kind !== 'primitive') return; // sprites entram com a arte (fase posterior)
    g.fillStyle(r.color, 1);

    if (r.shape === 'triangle') {
      const b = boundsOf(hitbox); // ápice em +x (pássaro voltado para a direita)
      g.fillTriangle(cx + b.minX, cy + b.minY, cx + b.minX, cy + b.maxY, cx + b.maxX, cy);
      return;
    }

    switch (hitbox.kind) {
      case 'aabb':
        g.fillRect(cx - hitbox.halfW, cy - hitbox.halfH, hitbox.halfW * 2, hitbox.halfH * 2);
        break;
      case 'circle':
        g.fillCircle(cx, cy, hitbox.radius);
        break;
      case 'polygon':
        g.fillPoints(
          hitbox.points.map((p) => new Phaser.Math.Vector2(cx + p.x, cy + p.y)),
          true,
        );
        break;
    }
  }
}
