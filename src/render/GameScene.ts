import * as Phaser from 'phaser';
import { boundsOf, leftExtent, rightExtent } from '@core/sim';
import type { Entity, Hitbox } from '@core/sim';
import { renderableFor, DINO_TYPE_ID } from './manifest';
import type { MatchController } from './match';
import type { PauseController } from './input';
import { PARALLAX_LAYERS, parallaxTileOffset } from './parallax';
import type { ParallaxLayer } from './parallax';
import { isHorizontallyVisible } from './culling';
import { paletteFor, timeOfDayForSeed } from './daynight';
import { i18n } from '@services/i18n';
import { HudTicker, formatHudValues } from './hud';
import { formatGameOverStats } from './gameover';
import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  DINO_SCREEN_X,
  CULL_MARGIN,
  GROUND_THICKNESS,
  PAUSE_OVERLAY_COLOR,
  PAUSE_OVERLAY_ALPHA,
  HUD_DEPTH,
  HUD_TEXT_X,
  HUD_TEXT_Y,
  HUD_FONT_SIZE,
  HUD_TEXT_COLOR,
  READY_PROMPT_DEPTH,
  READY_PROMPT_FONT_SIZE,
  READY_PROMPT_COLOR,
  GAMEOVER_OVERLAY_ALPHA,
  GAMEOVER_OVERLAY_DEPTH,
  GAMEOVER_CONTENT_DEPTH,
  GAMEOVER_TITLE_FONT_SIZE,
  GAMEOVER_STAT_FONT_SIZE,
  GAMEOVER_BUTTON_FONT_SIZE,
  GAMEOVER_TEXT_COLOR,
  GAMEOVER_BUTTON_COLOR,
  GAMEOVER_BUTTON_DISABLED_COLOR,
} from './constants';

/** Renderiza o WorldState lido do core via MatchController. Não altera a simulação (REGRA 1). */
export class GameScene extends Phaser.Scene {
  private readonly match: MatchController;
  private readonly pause: PauseController;
  private parallaxTiles: Phaser.GameObjects.TileSprite[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private pauseOverlay!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private hudTicker!: HudTicker;
  private readyPrompt!: Phaser.GameObjects.Text;
  private gameOverBg!: Phaser.GameObjects.Graphics;
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverStats!: Phaser.GameObjects.Text;
  private gameOverRestart!: Phaser.GameObjects.Text;
  private gameOverQuit!: Phaser.GameObjects.Text;
  private bandsGfx!: Phaser.GameObjects.Graphics;
  private appliedDayNightSeed: string | null = null;
  private wasDead = false;
  private dinoBoundsHitbox: Hitbox | null = null;
  private dinoBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  constructor(match: MatchController, pause: PauseController) {
    super('GameScene');
    this.match = match;
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

    // Cenário fixo (scrollFactor 0): faixas de teto e chão. Cores vêm da paleta de tempo do dia
    // (3.3), aplicada aqui e no restart via applyDayNight — desenho só na transição (REGRA 3).
    this.bandsGfx = this.add.graphics().setScrollFactor(0);

    // Tempo do dia (3.3): paleta derivada da seed da partida. Céu + faixas + tint de parallax.
    this.applyDayNight(this.match.seedLabel);

    // Graphics do mundo (scrollFactor 1 ⇒ acompanha a câmera).
    this.gfx = this.add.graphics();

    // Overlay de pausa: retângulo semitransparente de tela cheia (scrollFactor 0, depth 1000).
    this.pauseOverlay = this.add.graphics().setScrollFactor(0);
    this.pauseOverlay.fillStyle(PAUSE_OVERLAY_COLOR, PAUSE_OVERLAY_ALPHA);
    this.pauseOverlay.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.pauseOverlay.setDepth(1000);
    this.pauseOverlay.setVisible(false);

    // HUD (2.4): texto de leitura throttled. Depth abaixo do overlay de pausa.
    this.hudTicker = new HudTicker();
    this.hudText = this.add
      .text(HUD_TEXT_X, HUD_TEXT_Y, '', { fontSize: HUD_FONT_SIZE, color: HUD_TEXT_COLOR })
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.refreshHud(0);

    // Prompt de início (2.5): visível só no estado `ready`.
    this.readyPrompt = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, i18n.t('match.tapToStart'), {
        fontSize: READY_PROMPT_FONT_SIZE,
        color: READY_PROMPT_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(READY_PROMPT_DEPTH);

    // Game Over (2.6): overlay no estado `dead`. Criado 1×, escondido por default.
    this.gameOverBg = this.add.graphics().setScrollFactor(0).setDepth(GAMEOVER_OVERLAY_DEPTH);
    this.gameOverBg.fillStyle(PAUSE_OVERLAY_COLOR, GAMEOVER_OVERLAY_ALPHA);
    this.gameOverBg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.gameOverBg.setVisible(false);

    this.gameOverTitle = this.add
      .text(VIEW_WIDTH / 2, 36, i18n.t('gameover.title'), {
        fontSize: GAMEOVER_TITLE_FONT_SIZE,
        color: GAMEOVER_TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false);

    this.gameOverStats = this.add
      .text(VIEW_WIDTH / 2, 78, '', {
        fontSize: GAMEOVER_STAT_FONT_SIZE,
        color: GAMEOVER_TEXT_COLOR,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false);

    this.gameOverRestart = this.add
      .text(VIEW_WIDTH / 2 - 44, 130, i18n.t('gameover.restart'), {
        fontSize: GAMEOVER_BUTTON_FONT_SIZE,
        color: GAMEOVER_BUTTON_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.gameOverRestart.on('pointerdown', () => this.match.restart());

    this.gameOverQuit = this.add
      .text(VIEW_WIDTH / 2 + 44, 130, i18n.t('gameover.quit'), {
        fontSize: GAMEOVER_BUTTON_FONT_SIZE,
        color: GAMEOVER_BUTTON_DISABLED_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(GAMEOVER_CONTENT_DEPTH)
      .setVisible(false); // stub desabilitado: não interativo (ativa na Fase 4)

    // Teclado de restart em `dead` vive no caminho único de `bindGameControls` (evita a corrida
    // com este listener e o flap-de-início global). Aqui só o botão Reiniciar (ponteiro) reinicia.
  }

  override update(_time: number, deltaMs: number): void {
    const paused = this.pause.paused;
    this.pauseOverlay.setVisible(paused);
    this.syncGameOver();

    // Restart traz nova seed ⇒ possivelmente nova fase do dia. Compara-e-aplica só na troca
    // (string compare por frame não aloca; o redesenho só ocorre na transição — REGRA 3).
    if (this.match.seedLabel !== this.appliedDayNightSeed) {
      this.applyDayNight(this.match.seedLabel);
    }

    if (paused) return; // congela a sim; o último frame desenhado permanece sob o overlay

    const match = this.match;
    match.advance(deltaMs / 1000); // no-op fora de `playing`
    this.readyPrompt.setVisible(match.phase === 'ready');
    this.syncGameOver(); // reflete morte ocorrida neste frame

    const loop = match.loop;
    const world = match.world;

    // Câmera segue o dino interpolado; vertical não scrolla (o mundo cabe na altura).
    this.cameras.main.scrollX = loop.renderX - DINO_SCREEN_X;

    const scrollX = this.cameras.main.scrollX;
    for (let i = 0; i < this.parallaxTiles.length; i++) {
      this.parallaxTiles[i]!.tilePositionX = parallaxTileOffset(scrollX, PARALLAX_LAYERS[i]!.scrollFactor);
    }

    const g = this.gfx;
    g.clear();
    this.drawVisible(g, world.obstacles, scrollX);
    this.drawVisible(g, world.collectibles, scrollX);
    this.drawVisible(g, world.powerups, scrollX);
    this.drawPrimitive(g, DINO_TYPE_ID, world.pterodactyl.hitbox, loop.renderX, loop.renderY);

    const fps = this.hudTicker.tick(deltaMs / 1000);
    if (fps !== null) this.refreshHud(fps);
  }

  /** Reconstrói o texto do HUD (só no refresh throttled ⇒ fora do hot path por frame). */
  private refreshHud(fps: number): void {
    const world = this.match.world;
    const v = formatHudValues({
      distance: world.distance,
      food: world.food,
      fps,
      level: world.level,
      speed: world.scrollSpeed,
      seed: this.match.seedLabel,
    });
    this.hudText.setText([
      i18n.t('hud.distance', { value: v.distance }),
      i18n.t('hud.food', { value: v.food }),
      i18n.t('hud.fps', { value: v.fps }),
      i18n.t('hud.level', { value: v.level }),
      i18n.t('hud.speed', { value: v.speed }),
      i18n.t('hud.seed', { value: v.seed }),
    ]);
  }

  /** Mostra/esconde o overlay de Game Over; refaz as estatísticas 1× ao ENTRAR em `dead`. */
  private syncGameOver(): void {
    const dead = this.match.phase === 'dead';
    this.gameOverBg.setVisible(dead);
    this.gameOverTitle.setVisible(dead);
    this.gameOverStats.setVisible(dead);
    this.gameOverRestart.setVisible(dead);
    this.gameOverQuit.setVisible(dead);
    if (dead && !this.wasDead) this.refreshGameOverStats(); // transição ⇒ 1× (REGRA 3)
    this.wasDead = dead;
  }

  private refreshGameOverStats(): void {
    const w = this.match.world;
    const v = formatGameOverStats({ distance: w.distance, food: w.food, nearMisses: w.nearMisses });
    this.gameOverStats.setText([
      i18n.t('gameover.distance', { value: v.distance }),
      i18n.t('gameover.food', { value: v.food }),
      i18n.t('gameover.nearMisses', { value: v.nearMisses }),
    ]);
  }

  private drawEntity(g: Phaser.GameObjects.Graphics, e: Entity): void {
    const typeId = e.tags[0] ?? '';
    this.drawPrimitive(g, typeId, e.hitbox, e.transform.position.x, e.transform.position.y);
  }

  /** Desenha só as entidades cuja extensão horizontal intersecta o viewport (culling, REGRA 3). */
  private drawVisible(g: Phaser.GameObjects.Graphics, entities: readonly Entity[], scrollX: number): void {
    for (const e of entities) {
      const x = e.transform.position.x;
      if (!isHorizontallyVisible(x, leftExtent(e.hitbox), rightExtent(e.hitbox), scrollX, VIEW_WIDTH, CULL_MARGIN)) {
        continue;
      }
      this.drawEntity(g, e);
    }
  }

  /** Aplica a paleta de tempo do dia (3.3): céu, faixas chão/teto e tint das camadas de parallax.
   *  Só chamado na criação e quando a seed da partida muda (restart) — nunca por frame (REGRA 3). */
  private applyDayNight(seed: string): void {
    const p = paletteFor(timeOfDayForSeed(seed));
    // sky < 0x1000000 ⇒ Phaser trata como RGB opaco (alpha 255). Cobre o backgroundColor do jogo.
    this.cameras.main.setBackgroundColor(p.sky);
    const g = this.bandsGfx;
    g.clear();
    g.fillStyle(p.ceiling, 1);
    g.fillRect(0, 0, VIEW_WIDTH, GROUND_THICKNESS);
    g.fillStyle(p.ground, 1);
    g.fillRect(0, VIEW_HEIGHT - GROUND_THICKNESS, VIEW_WIDTH, GROUND_THICKNESS);
    for (const tile of this.parallaxTiles) tile.setTint(p.parallaxTint);
    this.appliedDayNightSeed = seed;
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
      if (this.dinoBoundsHitbox !== hitbox) {
        this.dinoBounds = boundsOf(hitbox); // ápice em +x (pássaro voltado para a direita)
        this.dinoBoundsHitbox = hitbox;
      }
      const b = this.dinoBounds;
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
      case 'polygon': {
        const pts = hitbox.points;
        g.beginPath();
        g.moveTo(cx + pts[0]!.x, cy + pts[0]!.y);
        for (let i = 1; i < pts.length; i++) g.lineTo(cx + pts[i]!.x, cy + pts[i]!.y);
        g.closePath();
        g.fillPath();
        break;
      }
      default: {
        const _exhaustive: never = hitbox;
        return _exhaustive;
      }
    }
  }
}
