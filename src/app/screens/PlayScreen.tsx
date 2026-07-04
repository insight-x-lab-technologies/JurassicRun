import { useLayoutEffect, useRef } from 'preact/hooks';
import { back } from '../router';
import { i18n } from '@services/i18n';

export function PlayScreen() {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('../game/startGame').then(({ startGame }) => {
      const el = containerRef.current;
      if (cancelled || el === null) return;
      stop = startGame(el);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div class="play-screen">
      <button class="btn btn--ghost play-screen__back" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
      <div class="play-screen__canvas" ref={containerRef} />
    </div>
  );
}
