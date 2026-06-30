import * as Phaser from 'phaser';
import type { WorldState } from '@core/sim';
import { GameScene } from './GameScene';
import { NullInputSource } from './input';
import type { InputSource } from './input';
import { VIEW_WIDTH, VIEW_HEIGHT, SKY_COLOR } from './constants';

/** Cria o Phaser.Game montando a GameScene que renderiza `world`. Input default = nulo (2.2 pluga real). */
export function createGame(
  parent: string | HTMLElement,
  world: WorldState,
  input: InputSource = new NullInputSource(),
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: SKY_COLOR,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new GameScene(world, input)],
  });
}
