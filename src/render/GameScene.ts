import * as Phaser from 'phaser';
import { boundsOf } from '@core/sim';
import type { Entity, Hitbox, WorldState } from '@core/sim';
import { FixedStepLoop } from './loop';
import { renderableFor, DINO_TYPE_ID } from './manifest';
import type { InputSource, PauseController } from './input';
import { PARALLAX_LAYERS, parallaxTileOffset } from './parallax';
import type { ParallaxLayer } from './parallax';
import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  DINO_SCREEN_X,
  GROUND_COLOR,
  CEILING_COLOR,
  GROUND_THICKNESS,
  PAUSE_OVERLAY_COLOR,
  PAUSE_OVERLAY_ALPHA,
} from './constants';

/** Renderiza o WorldState lido do core. Não altera a simulação (REGRA 1). */
export class GameScene extends Phaser.Scene {
  private readonly world: WorldState;
  private readonly inputSource: InputSource;
  private readonly pause: PauseController;
  private loop!: FixedStepLoop;
  private parallaxTiles: Phaser.GameObjects.TileSprite[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private pauseOverlay!: Phaser.GameObjects.Graphics;

  constructor(world: WorldState, input: InputSource, pause: PauseController) {
    super('GameScene');
    this.world = world;
    this.inputSource = input;
    this.pause = pause;
  }

  create(): void {
    // Parallax (2.3): camadas de silhueta atrás do mundo. Texturas geradas 1×; por frame só
    // ajusta tilePositionX (zero alocação — REGRA 3). scrollFactor(0) prende à câmera.
    this.parallaxTiles = PARALLAX_LAYERS.map((layer, index) => {
      const key = this.ensureLayerTexture(layer);
      const tile = this.add
        .tileSprite(0, 0, VIEW_WIDTH, VIEW_HEIGHT, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-(PARALLAX_LAYERS.length - index)); // far mais negativo, atrás de tudo
      return tile;
    });

    // Cenário fixo (scrollFactor 0): faixas de teto e chão.
    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillStyle(CEILING_COLOR, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, GROUND_THICKNESS);
    bg.fillStyle(GROUND_COLOR, 1);
    bg.fillRect(0, VIEW_HEIGHT - GROUND_THICKNESS, VIEW_WIDTH, GROUND_THICKNESS);

    // Graphics do mundo (scrollFactor 1 ⇒ acompanha a câmera).
    this.gfx = this.add.graphics();
    this.loop = new FixedStepLoop(this.world, this.inputSource);

    // Overlay de pausa: retângulo semitransparente de tela cheia (scrollFactor 0, depth 1000).
    this.pauseOverlay = this.add.graphics().setScrollFactor(0);
    this.pauseOverlay.fillStyle(PAUSE_OVERLAY_COLOR, PAUSE_OVERLAY_ALPHA);
    this.pauseOverlay.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.pauseOverlay.setDepth(1000);
    this.pauseOverlay.setVisible(false);
  }

  override update(_time: number, deltaMs: number): void {
    const paused = this.pause.paused;
    this.pauseOverlay.setVisible(paused);
    if (paused) return; // congela a sim; o último frame desenhado permanece sob o overlay

    this.loop.advance(deltaMs / 1000);

    // Câmera segue o dino interpolado; vertical não scrolla (o mundo cabe na altura).
    this.cameras.main.scrollX = this.loop.renderX - DINO_SCREEN_X;

    const scrollX = this.cameras.main.scrollX;
    for (let i = 0; i < this.parallaxTiles.length; i++) {
      this.parallaxTiles[i]!.tilePositionX = parallaxTileOffset(scrollX, PARALLAX_LAYERS[i]!.scrollFactor);
    }

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

  /** Gera (1×) a textura de tile de uma camada: linha de triângulos como silhueta. Chave = id. */
  private ensureLayerTexture(layer: ParallaxLayer): string {
    const key = `parallax:${layer.id}`;
    if (this.textures.exists(key)) return key;
    if (layer.visual.kind !== 'primitive') return key; // sprite: arte real (fase posterior)
    const { color, tileWidth, peakHeight, baseFromBottom } = layer.visual;
    const baseY = VIEW_HEIGHT - baseFromBottom; // base da silhueta (px do topo)
    const topY = baseY - peakHeight; // ápice dos triângulos
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    // Dois triângulos por tile garantem casamento nas bordas ao tilear.
    const half = tileWidth / 2;
    for (let x = 0; x < tileWidth; x += half) {
      g.fillTriangle(x, baseY, x + half / 2, topY, x + half, baseY);
    }
    g.generateTexture(key, tileWidth, VIEW_HEIGHT);
    g.destroy();
    return key;
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
