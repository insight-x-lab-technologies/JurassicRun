import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { useRotateHint } from '../hooks/useRotateHint';
import type { MatchMode } from '@render/matchFactory';
import type { GameHandle, MatchSnapshot, HudLive } from '../game/startGame';
import { GameOverOverlay } from '../game/GameOverOverlay';
import { ReadyPrompt } from '../game/ReadyPrompt';
import { Hud } from '../game/Hud';
import { PauseOverlay } from '../game/PauseOverlay';

const INITIAL: MatchSnapshot = { phase: 'ready', paused: false, gameOver: null, hud: null };
const HUD_INTERVAL_MS = 200; // ~5 Hz

export function PlayScreen({ mode = 'endless' }: { mode?: MatchMode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const suggestRotate = useRotateHint();
  // `snap` guarda só o que dispara overlays (fase/pausa/gameover) — atualizado SÓ na mudança (gate).
  const [snap, setSnap] = useState<MatchSnapshot>(INITIAL);
  // HUD (stats vivos + fps) atualizado a ~5 Hz para não re-renderizar 60×/s.
  const [hud, setHud] = useState<{ hud: HudLive; fps: number } | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    let raf = 0;
    let stop: (() => void) | undefined;
    let prevPhase = INITIAL.phase;
    let prevPaused = INITIAL.paused;
    let prevGameOver = INITIAL.gameOver;
    let lastHud = 0;
    let frames = 0;
    let accumMs = 0;
    let lastT = performance.now();

    void import('../game/startGame').then(({ startGame }) => {
      const el = containerRef.current;
      if (cancelled || el === null) return;
      const handle = startGame(el, mode);
      handleRef.current = handle;
      stop = handle.stop;
      const tick = (t: number): void => {
        const s = handle.snapshot();
        // Overlays: só re-renderiza quando fase/pausa/gameover mudam.
        if (s.phase !== prevPhase || s.paused !== prevPaused || s.gameOver !== prevGameOver) {
          setSnap(s);
          prevPhase = s.phase;
          prevPaused = s.paused;
          prevGameOver = s.gameOver;
        }
        // FPS por delta de rAF + HUD throttled a ~5 Hz.
        accumMs += t - lastT;
        frames += 1;
        lastT = t;
        if (t - lastHud >= HUD_INTERVAL_MS) {
          const fps = accumMs > 0 ? Math.round((frames * 1000) / accumMs) : 0;
          setHud(s.hud !== null ? { hud: s.hud, fps } : null);
          lastHud = t;
          frames = 0;
          accumMs = 0;
        }
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
      {snap.phase === 'playing' && !snap.paused && hud !== null && <Hud hud={hud.hud} fps={hud.fps} />}
      {snap.phase === 'ready' && !snap.paused && <ReadyPrompt />}
      {snap.paused && <PauseOverlay />}
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
