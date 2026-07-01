import * as Phaser from 'phaser';
import { GameScene } from './GameScene';
import { PauseController } from './input';
import type { MatchController } from './match';
import { VIEW_WIDTH, VIEW_HEIGHT, SKY_COLOR } from './constants';

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
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: SKY_COLOR,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new GameScene(match, pause)],
  });
}
