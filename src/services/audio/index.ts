import { effect, signal } from '@preact/signals';
import { settingsService } from '@services/settings';
import { route } from '@app/router';
import { resolveAudioTarget } from './policy';
import { WebAudioEngine, type AudioEngine } from './engine';
import type { SfxId } from './tracks';

class AudioService {
  private engine: AudioEngine = new WebAudioEngine();
  private readonly _unlocked = signal(false);
  private _sfxGain = 0;
  private dispose: (() => void) | null = null;

  /** Liga a reatividade. `engine` injetável para testes/SSR. */
  init(engine: AudioEngine = new WebAudioEngine()): void {
    this.dispose?.();
    this.engine = engine;
    this._unlocked.value = false;
    this.dispose = effect(() => {
      const target = resolveAudioTarget({
        route: route.value,
        volume: settingsService.volume.value,
        menuMusic: settingsService.menuMusic.value,
        gameplayMusic: settingsService.gameplayMusic.value,
        unlocked: this._unlocked.value,
      });
      this._sfxGain = target.sfxGain;
      if (target.track === null) {
        if (this.engine.running !== null) this.engine.stopMusic();
        return;
      }
      if (this.engine.running !== target.track) {
        this.engine.playMusic(target.track, target.musicGain);
      } else {
        this.engine.setMusicGain(target.musicGain);
      }
    });
  }

  /** Desbloqueia o áudio no 1º gesto do usuário (política de autoplay). Idempotente. */
  unlock(): void {
    if (this._unlocked.value) return;
    this._unlocked.value = true; // o effect reavalia e inicia a música
    void this.engine.resume();
  }

  playSfx(id: SfxId): void {
    if (!this._unlocked.value || this._sfxGain <= 0) return;
    this.engine.playSfx(id, this._sfxGain);
  }
}

export const audioService = new AudioService();
export type { AudioService };

/**
 * SFX global de botões por delegação + unlock no 1º gesto.
 * Retorna cleanup. `service` default = singleton.
 */
export function bindButtonSfx(root: EventTarget, service: AudioService = audioService): () => void {
  const onClick = (e: Event): void => {
    const t = e.target;
    if (t instanceof Element && t.closest('button') !== null) {
      service.unlock();
      service.playSfx('click');
    }
  };
  const onGesture = (): void => service.unlock();
  root.addEventListener('click', onClick);
  window.addEventListener('pointerdown', onGesture, { once: true });
  window.addEventListener('keydown', onGesture, { once: true });
  return () => {
    root.removeEventListener('click', onClick);
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
  };
}

export type { AudioEngine } from './engine';
