import { FLAP_KEYS, PAUSE_KEYS } from './constants';
import type { FlapInputSource, PauseController } from './input';

/**
 * Casca DOM: encaminha toque/clique/tecla para as peças puras (sem lógica de jogo).
 * Retorna um cleanup que remove os listeners.
 */
export function bindGameControls(
  target: Window,
  controls: { flap: FlapInputSource; pause: PauseController; onFlap?: () => void },
): () => void {
  const { flap, pause, onFlap } = controls;
  const onPointerDown = (e: PointerEvent): void => {
    if (flap.press(`pointer:${e.pointerId}`)) onFlap?.();
  };
  const onPointerUp = (e: PointerEvent): void => flap.release(`pointer:${e.pointerId}`);
  const onKeyDown = (e: KeyboardEvent): void => {
    if (PAUSE_KEYS.includes(e.code)) {
      pause.toggle();
      return;
    }
    if (FLAP_KEYS.includes(e.code)) {
      e.preventDefault(); // Space/ArrowUp não rolam a página
      if (flap.press(`key:${e.code}`)) onFlap?.();
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (FLAP_KEYS.includes(e.code)) flap.release(`key:${e.code}`);
  };
  const onBlur = (): void => pause.pause();

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return () => {
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerUp);
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}
