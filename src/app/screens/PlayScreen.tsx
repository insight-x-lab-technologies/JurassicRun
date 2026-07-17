import { useLayoutEffect, useRef } from 'preact/hooks';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { useRotateHint } from '../hooks/useRotateHint';
import type { MatchMode } from '@render/matchFactory';

export function PlayScreen({ mode = 'endless' }: { mode?: MatchMode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestRotate = useRotateHint();

  useLayoutEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('../game/startGame').then(({ startGame }) => {
      const el = containerRef.current;
      if (cancelled || el === null) return;
      stop = startGame(el, mode);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode]);

  return (
    <div class="play-screen">
      <button class="btn btn--ghost play-screen__back" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
      <div class="play-screen__canvas" ref={containerRef} />
      {suggestRotate && (
        <div class="rotate-hint" aria-live="polite">
          <span class="rotate-hint__icon" aria-hidden="true">
            📱↻
          </span>
          <p class="rotate-hint__text">{i18n.t('rotateHint.message')}</p>
        </div>
      )}
    </div>
  );
}
