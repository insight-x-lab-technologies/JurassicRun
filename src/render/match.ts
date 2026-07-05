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
  /** Disparado 1× na transição playing → dead (a app credita moedas da comida). */
  onGameOver?: (world: WorldState) => void;
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
    if (!this._world.alive) {
      this._phase = 'dead';
      this.hooks.onGameOver?.(this._world);
    }
  }

  /** Borda de pressão de flap vinda da casca. Só inicia a partida em `ready`. */
  notifyFlap(): void {
    if (this._phase === 'ready') {
      this._phase = 'playing';
    }
    // em `playing`: o flap é tratado pelo core via InputSource. Em `dead`: no-op (restart é explícito).
  }

  /** Reinicia após a morte: nova partida (nova seed/world) + hook. No-op fora de `dead`. */
  restart(): void {
    if (this._phase !== 'dead') return;
    this.startMatch();
    this.hooks.onNewMatch?.();
  }

  private startMatch(): void {
    const init = this.factory();
    this._world = init.world;
    this._seedLabel = init.seedLabel;
    this._loop = new FixedStepLoop(this._world, this.input);
    this._phase = 'ready';
  }
}
