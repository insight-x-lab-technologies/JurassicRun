import * as Phaser from 'phaser';
import type { WorldState } from '@core/sim';
import { GameScene } from './GameScene';
import { NullInputSource, PauseController } from './input';
import type { InputSource } from './input';
import { VIEW_WIDTH, VIEW_HEIGHT, SKY_COLOR } from './constants';

export interface GameDeps {
  input?: InputSource;
  pause?: PauseController;
}

/** Cria o Phaser.Game montando a GameScene que renderiza `world`. Deps default = nulo/sem pausa (2.2 pluga real). */
export function createGame(
  parent: string | HTMLElement,
  world: WorldState,
  deps: GameDeps = {},
): Phaser.Game {
  const input = deps.input ?? new NullInputSource();
  const pause = deps.pause ?? new PauseController();
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: SKY_COLOR,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new GameScene(world, input, pause)],
  });
}
