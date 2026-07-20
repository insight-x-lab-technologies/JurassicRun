import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { useRotateHint } from '../hooks/useRotateHint';
import type { MatchMode } from '@render/matchFactory';
import type { GameHandle, MatchSnapshot } from '../game/startGame';
import { GameOverOverlay } from '../game/GameOverOverlay';
import { ReadyPrompt } from '../game/ReadyPrompt';

const INITIAL: MatchSnapshot = { phase: 'ready', paused: false, gameOver: null };

export function PlayScreen({ mode = 'endless' }: { mode?: MatchMode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const suggestRotate = useRotateHint();
  const [snap, setSnap] = useState<MatchSnapshot>(INITIAL);

  useLayoutEffect(() => {
    let cancelled = false;
    let raf = 0;
    let stop: (() => void) | undefined;
    void import('../game/startGame').then(({ startGame }) => {
      const el = containerRef.current;
      if (cancelled || el === null) return;
      const handle = startGame(el, mode);
      handleRef.current = handle;
      stop = handle.stop;
      const tick = (): void => {
        setSnap(handle.snapshot());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      handleRef.current = null;
      stop?.();
    };
  }, [mode]);

  return (
    <div class="play-screen">
      <button class="btn btn--ghost play-screen__back" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
      <div class="play-screen__canvas" ref={containerRef} />
      {snap.phase === 'ready' && !snap.paused && <ReadyPrompt />}
      {snap.phase === 'dead' && snap.gameOver !== null && (
        <GameOverOverlay
          stats={snap.gameOver}
          onRestart={() => handleRef.current?.restart()}
          onQuit={() => back()}
        />
      )}
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
