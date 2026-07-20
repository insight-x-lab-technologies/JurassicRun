import type { VNode } from 'preact';
import { i18n } from '@services/i18n';

/** Overlay DOM de pausa (W4): dim + "Pausado". pointer-events:none ⇒ o toque/tecla retoma via controls. */
export function PauseOverlay(): VNode {
  return (
    <div class="pause-overlay" aria-live="polite">
      <p class="pause-overlay__title">{i18n.t('pause.title')}</p>
      <p class="pause-overlay__hint">{i18n.t('pause.resume')}</p>
    </div>
  );
}
