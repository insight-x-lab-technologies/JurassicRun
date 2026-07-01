import type { InputFrame } from '@core/sim';

/** Fonte de input amostrada uma vez por step da simulação. 2.2 adiciona toque/tecla. */
export interface InputSource {
  sample(): InputFrame;
}

/** Fonte nula: nunca pede flap. Usada em 2.1 (input real é 2.2). */
export class NullInputSource implements InputSource {
  private readonly frame: InputFrame = { flap: false };
  sample(): InputFrame {
    return this.frame;
  }
}

/**
 * Fonte de flap dirigida por DOM (toque/clique/tecla), amostrada 1×/step.
 * Reporta o estado ATUAL do botão; a borda (1 flap por pressão) é do core.
 * - `active`: ids das fontes seguradas (multi-fonte + dedup de autorepeat).
 * - `latched`: garante 1 flap mesmo num tap sub-frame (press+release entre samples).
 * - `wasHeld`: flag interna que distingue autorepeat (press do mesmo id já ativo)
 *   de tap: quando o último active é liberado E wasHeld=true, o latch é cancelado
 *   porque a fonte estava genuinamente segurada (não foi um tap sub-frame).
 * Alocação-zero: `sample()` reusa `this.frame`.
 */
export class FlapInputSource implements InputSource {
  private readonly active = new Set<string>();
  private latched = false;
  private wasHeld = false;
  private readonly frame: InputFrame = { flap: false };

  /** Pressiona uma fonte (id estável). Retorna true numa pressão fresca (borda), false no autorepeat. */
  press(id: string): boolean {
    if (this.active.has(id)) {
      // autorepeat: mesmo id pressionado enquanto já ativo — marca "segurado"
      this.wasHeld = true;
      return false;
    }
    this.active.add(id);
    this.latched = true;
    return true;
  }

  /** Solta uma fonte; soltar id ausente é no-op. */
  release(id: string): void {
    this.active.delete(id);
    if (this.active.size === 0) {
      // último active liberado: se a fonte estava segurada, cancela o latch
      if (this.wasHeld) this.latched = false;
      this.wasHeld = false;
    }
  }

  /** Zera held + latch (anti-flap-fantasma ao pausar). */
  reset(): void {
    this.active.clear();
    this.latched = false;
    this.wasHeld = false;
  }

  sample(): InputFrame {
    this.frame.flap = this.active.size > 0 || this.latched;
    this.latched = false;
    return this.frame;
  }
}

/**
 * Estado de pausa da camada de render. Pausar = a GameScene deixa de chamar step.
 * `onPause` dispara ao ENTRAR em pausa (a integração liga em FlapInputSource.reset).
 */
export class PauseController {
  private _paused = false;
  onPause?: () => void;

  get paused(): boolean {
    return this._paused;
  }

  pause(): void {
    if (this._paused) return;
    this._paused = true;
    this.onPause?.();
  }

  resume(): void {
    this._paused = false;
  }

  toggle(): void {
    if (this._paused) this.resume();
    else this.pause();
  }
}
