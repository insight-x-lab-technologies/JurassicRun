import * as Phaser from 'phaser';
import { GameScene } from './GameScene';
import { PauseController } from './input';
import type { MatchController } from './match';
import { SKY_COLOR } from './constants';
import { renderCanvasSize, resolveRenderScale } from './resolution';

/** Mede o container onde o canvas vai viver, para dimensionar o framebuffer ao display real. */
function containerSize(parent: string | HTMLElement): { width: number; height: number } {
  const el = typeof parent === 'string' ? document.getElementById(parent) : parent;
  const rect = el?.getBoundingClientRect();
  // Container ainda sem layout (0×0) ⇒ cai na viewport; resolveRenderScale trata o degenerado.
  if (rect === undefined || rect.width === 0 || rect.height === 0) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: rect.width, height: rect.height };
}

export interface GameDeps {
  pause?: PauseController;
}

/** Cria o Phaser.Game montando a GameScene que renderiza a partida corrente do `match`. */
export function createGame(
  parent: string | HTMLElement,
  match: MatchController,
  deps: GameDeps = {},
): Phaser.Game {
  const pause = deps.pause ?? new PauseController();
  // W5: o canvas ganha os pixels que o display realmente vai mostrar (1:1, sem reamostragem).
  // O campo LÓGICO segue 320×180 unidades de mundo — a GameScene multiplica pela escala ao
  // desenhar. Medido 1×, na criação: trocar de tela redimensiona por CSS (Scale.FIT).
  const box = containerSize(parent);
  const scale = resolveRenderScale(box.width, box.height, window.devicePixelRatio);
  const { width, height } = renderCanvasSize(scale);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: SKY_COLOR,
    // antialias: suaviza o resample quando a tela não bate exatamente com o canvas (a arte é
    // pintada, não pixel art).
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new GameScene(match, pause, scale)],
  });
}
