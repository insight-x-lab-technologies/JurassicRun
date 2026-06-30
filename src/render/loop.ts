import { FIXED_DT, step } from '@core/sim';
import type { WorldState } from '@core/sim';
import type { InputSource } from './input';
import { lerp } from './interpolate';
import { MAX_FRAME_TIME } from './constants';

/**
 * Loop canônico de passo fixo (ARCHITECTURE.md): acumulador + steps fixos, render desacoplado.
 * O estado de interpolação é só a posição do dino (obstáculos são estáticos em coords de mundo,
 * então a câmera seguindo o dino interpolado suaviza todo o cenário) ⇒ sem clone de mundo (REGRA 3).
 */
export class FixedStepLoop {
  readonly world: WorldState;
  private readonly input: InputSource;
  private accumulator = 0;
  private prevX: number;
  private prevY: number;

  constructor(world: WorldState, input: InputSource) {
    this.world = world;
    this.input = input;
    const p = world.pterodactyl.transform.position;
    this.prevX = p.x;
    this.prevY = p.y;
  }

  /** Acumula dt (clampado) e roda os steps fixos devidos. Retorna quantos steps rodaram. */
  advance(dtSeconds: number): number {
    const dt = dtSeconds > MAX_FRAME_TIME ? MAX_FRAME_TIME : dtSeconds;
    this.accumulator += dt;
    const pos = this.world.pterodactyl.transform.position;
    let steps = 0;
    while (this.accumulator >= FIXED_DT) {
      this.prevX = pos.x; // snapshot 1 step atrás de `curr` (= pos após o step)
      this.prevY = pos.y;
      step(this.world, this.input.sample());
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    return steps;
  }

  /** Fração [0,1) do passo corrente (para interpolar o render). */
  get alpha(): number {
    return this.accumulator / FIXED_DT;
  }

  get renderX(): number {
    return lerp(this.prevX, this.world.pterodactyl.transform.position.x, this.alpha);
  }

  get renderY(): number {
    return lerp(this.prevY, this.world.pterodactyl.transform.position.y, this.alpha);
  }
}
