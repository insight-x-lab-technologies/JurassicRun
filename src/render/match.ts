import type { WorldState } from '@core/sim';
import { FixedStepLoop } from './loop';
import type { InputSource } from './input';

export type MatchPhase = 'ready' | 'playing' | 'dead';

/** Uma partida recém-criada: mundo inicial + rótulo da seed (exibido no HUD). */
export interface MatchInit {
  world: WorldState;
  seedLabel: string;
}

export interface MatchHooks {
  /** Disparado ao montar uma nova partida (a app liga em FlapInputSource.reset). */
  onNewMatch?: () => void;
}

/**
 * Máquina de estados do ciclo de partida (ready → playing → dead → restart).
 * PURO (sem phaser): possui o WorldState + FixedStepLoop da partida corrente.
 * A sim só avança em `playing`; `ready`/`dead` ficam congelados.
 */
export class MatchController {
  private readonly input: InputSource;
  private readonly factory: () => MatchInit;
  private readonly hooks: MatchHooks;
  private _phase: MatchPhase = 'ready';
  private _world!: WorldState;
  private _loop!: FixedStepLoop;
  private _seedLabel = '';

  constructor(input: InputSource, factory: () => MatchInit, hooks: MatchHooks = {}) {
    this.input = input;
    this.factory = factory;
    this.hooks = hooks;
    this.startMatch(); // primeira partida em ready (sem disparar onNewMatch no load)
  }

  get phase(): MatchPhase {
    return this._phase;
  }
  get world(): WorldState {
    return this._world;
  }
  get loop(): FixedStepLoop {
    return this._loop;
  }
  get seedLabel(): string {
    return this._seedLabel;
  }

  /** Avança a simulação só em `playing`; transiciona para `dead` quando o mundo morre. */
  advance(dtSeconds: number): void {
    if (this._phase !== 'playing') return;
    this._loop.advance(dtSeconds);
    if (!this._world.alive) this._phase = 'dead';
  }

  /** Borda de pressão de flap vinda da casca. */
  notifyFlap(): void {
    if (this._phase === 'ready') {
      this._phase = 'playing';
    } else if (this._phase === 'dead') {
      this.startMatch();
      this.hooks.onNewMatch?.();
    }
    // em `playing`: no-op (o flap é tratado pelo core via InputSource).
  }

  private startMatch(): void {
    const init = this.factory();
    this._world = init.world;
    this._seedLabel = init.seedLabel;
    this._loop = new FixedStepLoop(this._world, this.input);
    this._phase = 'ready';
  }
}
