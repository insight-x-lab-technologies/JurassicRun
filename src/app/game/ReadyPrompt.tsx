import type { VNode } from 'preact';
import { i18n } from '@services/i18n';

/** Prompt DOM de início (W3): "toque para começar". pointer-events:none ⇒ o tap passa ao canvas. */
export function ReadyPrompt(): VNode {
  return (
    <div class="ready-prompt" aria-live="polite">
      <p>{i18n.t('match.tapToStart')}</p>
    </div>
  );
}
