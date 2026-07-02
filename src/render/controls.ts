import { FLAP_KEYS, PAUSE_KEYS, CONFIRM_KEYS } from './constants';
import type { FlapInputSource, PauseController } from './input';

/**
 * Casca DOM: encaminha toque/clique/tecla para as peças puras (sem lógica de jogo).
 * Retorna um cleanup que remove os listeners.
 *
 * `isDead`/`onRestart`: em `dead`, uma tecla de confirmação reinicia POR ESTE caminho único
 * de teclado (não por um listener do Phaser em paralelo) — senão o restart e o flap-de-início
 * disputariam o mesmo keydown e a partida nova nasceria já em `playing`. O restart do PONTEIRO
 * é do botão Reiniciar (na cena), não daqui (toque em espaço vazio não reinicia).
 */
export function bindGameControls(
  target: Window,
  controls: {
    flap: FlapInputSource;
    pause: PauseController;
    onFlap?: () => void;
    onRestart?: () => void;
    isDead?: () => boolean;
  },
): () => void {
  const { flap, pause, onFlap, onRestart, isDead } = controls;
  const onPointerDown = (e: PointerEvent): void => {
    if (flap.press(`pointer:${e.pointerId}`)) onFlap?.();
  };
  const onPointerUp = (e: PointerEvent): void => flap.release(`pointer:${e.pointerId}`);
  const onKeyDown = (e: KeyboardEvent): void => {
    if (PAUSE_KEYS.includes(e.code)) {
      pause.toggle();
      return;
    }
    // Em `dead`, confirmar reinicia e NÃO vira flap (sem flap-fantasma na nova partida).
    if (isDead?.() && CONFIRM_KEYS.includes(e.code)) {
      e.preventDefault();
      onRestart?.();
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
