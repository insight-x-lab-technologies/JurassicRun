# UI W3: Game Over DOM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Game Over e o prompt "ready" viram overlays DOM ricos (diálogo emoldurado + botões) por cima do canvas, no lugar do texto cru no canvas Phaser.

**Architecture:** `startGame` expõe `{ stop, snapshot, restart }` (ponte Phaser→React); `PlayScreen` faz rAF-poll do `snapshot` e renderiza `GameOverOverlay`/`ReadyPrompt`; `GameScene` esconde o Game Over/ready in-canvas.

**Tech Stack:** Preact/signals, Phaser (casca), Vitest+happy-dom, CSS.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**.
- REGRA 3: o poll do PlayScreen só LÊ `snapshot` (compare de string), não toca o loop do jogo.
- REGRA 4: strings visíveis via i18n nos 10 locales.
- Sem dep nova. Um commit por task; rodapé `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Ponte `startGame` `{stop,snapshot,restart}` + i18n

**Files:**
- Modify: `src/app/game/startGame.ts`
- Modify: `src/app/screens/PlayScreen.tsx` (só o `.stop` — mínimo, compila)
- Modify: os 10 `src/i18n/locales/*.json`
- Modify: `tests/i18n/locales.test.ts` (allowlist, se alguma tradução coincidir com `en`)

**Interfaces:**
- Produces: `GameHandle { stop:()=>void; snapshot:()=>MatchSnapshot; restart:()=>void }`;
  `MatchSnapshot { phase: MatchPhase; paused: boolean; gameOver: GameOverStats | null }`;
  `GameOverStats { distance; food; nearMisses; score; coins; newRecord }`.

- [ ] **Step 1: Ponte em `startGame.ts`** — no topo, exportar os tipos:

```ts
import type { MatchPhase } from '@render/match';

export interface GameOverStats {
  readonly distance: number; readonly food: number; readonly nearMisses: number;
  readonly score: number; readonly coins: number; readonly newRecord: boolean;
}
export interface MatchSnapshot { readonly phase: MatchPhase; readonly paused: boolean; readonly gameOver: GameOverStats | null; }
export interface GameHandle { readonly stop: () => void; readonly snapshot: () => MatchSnapshot; readonly restart: () => void; }
```
Trocar a assinatura `export function startGame(...): () => void` por `: GameHandle`. Declarar
`let lastGameOver: GameOverStats | null = null;` antes do `new MatchController`. No `onNewMatch`,
zerar: `onNewMatch: () => { flap.reset(); lastGameOver = null; },`. No INÍCIO do `onGameOver: (w) => {`
(antes de creditar/gravar), guardar:

```ts
      const listFor =
        mode === 'daily' ? leaderboardService.daily
        : mode === 'weekly' ? leaderboardService.weekly
        : leaderboardService.endless;
      const prevBest = listFor.value[0]?.score ?? -1;
      lastGameOver = {
        distance: w.distance, food: w.food, nearMisses: w.nearMisses, score: w.score,
        coins: coinsForFood(w.food), newRecord: w.score > prevBest,
      };
```
Trocar o `return () => { cleanupControls(); game.destroy(true); };` por:

```ts
  const stop = () => { cleanupControls(); game.destroy(true); };
  return {
    stop,
    snapshot: () => ({ phase: match.phase, paused: pause.paused, gameOver: lastGameOver }),
    restart: () => match.restart(),
  };
```

- [ ] **Step 2: `PlayScreen` mínimo** — em `src/app/screens/PlayScreen.tsx`, trocar `stop = startGame(el, mode);` por `stop = startGame(el, mode).stop;` (mantém tudo funcionando; os overlays entram na Task 2).

- [ ] **Step 3: i18n** — adicionar 2 chaves ao objeto `gameover` de CADA um dos 10 `src/i18n/locales/*.json` (traduções nativas): `newRecord` e `coinsEarned` (com `{{value}}`). EN: `"newRecord": "New record!"`, `"coinsEarned": "+{{value}} coins"`. PT-BR: `"Novo recorde!"`, `"+{{value}} moedas"`. (Traduzir nas 10; se alguma ficar idêntica ao EN por empréstimo, adicionar à allowlist em `tests/i18n/locales.test.ts` com justificativa.)

- [ ] **Step 4: Rodar — tipos + i18n + suíte**

Run: `npm run check && npx vitest run tests/i18n && npm test`
Expected: verde (paridade + scanner AST OK; `check` limpo).

- [ ] **Step 5: Commit**

```bash
git add src/app/game/startGame.ts src/app/screens/PlayScreen.tsx src/i18n/locales tests/i18n/locales.test.ts
git commit -m "feat(ui-w3): ponte startGame {stop,snapshot,restart} + i18n gameover.newRecord/coinsEarned"
```

---

### Task 2: Overlays DOM (`GameOverOverlay`/`ReadyPrompt`) + PlayScreen

**Files:**
- Create: `src/app/game/GameOverOverlay.tsx`, `src/app/game/ReadyPrompt.tsx`
- Create: `tests/app/gameover-overlay.test.tsx`
- Modify: `src/app/screens/PlayScreen.tsx`, `src/app/styles/global.css`

**Interfaces:**
- Consumes: `GameHandle`/`MatchSnapshot`/`GameOverStats` (Task 1); `formatGameOverStats` (`@render/gameover`); `back` (router); i18n.

- [ ] **Step 1: `GameOverOverlay.tsx`**:

```tsx
import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import { formatGameOverStats } from '@render/gameover';
import type { GameOverStats } from './startGame';

export function GameOverOverlay(
  { stats, onRestart, onQuit }: { stats: GameOverStats; onRestart: () => void; onQuit: () => void },
): VNode {
  const v = formatGameOverStats({ distance: stats.distance, food: stats.food, nearMisses: stats.nearMisses });
  return (
    <div class="gameover" role="dialog" aria-modal="true">
      <h2 class="gameover__title screen__title">{i18n.t('gameover.title')}</h2>
      {stats.newRecord && <p class="gameover__badge" data-testid="gameover-record">{i18n.t('gameover.newRecord')}</p>}
      <dl class="gameover__stats">
        <div><span aria-hidden="true">📍</span> {i18n.t('gameover.distance', { value: v.distance })}</div>
        <div><span aria-hidden="true">🍖</span> {i18n.t('gameover.food', { value: v.food })}</div>
        <div><span aria-hidden="true">⚠️</span> {i18n.t('gameover.nearMisses', { value: v.nearMisses })}</div>
      </dl>
      <p class="gameover__coins">🪙 {i18n.t('gameover.coinsEarned', { value: stats.coins })}</p>
      <div class="gameover__actions">
        <button class="btn" data-testid="gameover-restart" onClick={onRestart}>{i18n.t('gameover.restart')}</button>
        <button class="btn btn--ghost" data-testid="gameover-quit" onClick={onQuit}>{i18n.t('gameover.quit')}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ReadyPrompt.tsx`**:

```tsx
import type { VNode } from 'preact';
import { i18n } from '@services/i18n';

export function ReadyPrompt(): VNode {
  return <div class="ready-prompt" aria-live="polite"><p>{i18n.t('match.tapToStart')}</p></div>;
}
```

- [ ] **Step 3: `PlayScreen` com poll + overlays** — reescrever `src/app/screens/PlayScreen.tsx`:

```tsx
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
      const tick = () => { setSnap(handle.snapshot()); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); handleRef.current = null; stop?.(); };
  }, [mode]);

  return (
    <div class="play-screen">
      <button class="btn btn--ghost play-screen__back" onClick={() => back()}>{i18n.t('nav.back')}</button>
      <div class="play-screen__canvas" ref={containerRef} />
      {snap.phase === 'ready' && !snap.paused && <ReadyPrompt />}
      {snap.phase === 'dead' && snap.gameOver && (
        <GameOverOverlay stats={snap.gameOver} onRestart={() => handleRef.current?.restart()} onQuit={() => back()} />
      )}
      {suggestRotate && (
        <div class="rotate-hint" aria-live="polite">
          <span class="rotate-hint__icon" aria-hidden="true">📱↻</span>
          <p class="rotate-hint__text">{i18n.t('rotateHint.message')}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: CSS** — em `global.css`, adicionar:

```css
/* UI W3: overlays DOM sobre o canvas. */
.ready-prompt {
  position: absolute; inset: 0; z-index: 15;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; /* o tap passa para o canvas e inicia a partida */
  font-size: var(--font-size-lg); color: var(--color-text);
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
}
.gameover {
  position: absolute; inset: 0; z-index: 30;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-3); padding: var(--space-5); text-align: center;
}
.gameover > * { position: relative; }
.gameover::before {
  content: ''; position: absolute;
  width: min(90%, 26rem); height: min(90%, 22rem);
  border-style: solid; border-color: transparent; border-width: 20px;
  border-image: var(--ui-panel) 30% fill / 20px / 0 stretch;
  z-index: -1;
}
.gameover__title { font-size: var(--font-size-lg); margin: 0; }
.gameover__badge { color: var(--color-accent); font-weight: 800; margin: 0; }
.gameover__stats { margin: 0; display: flex; flex-direction: column; gap: var(--space-1); }
.gameover__coins { color: var(--color-gold); margin: 0; }
.gameover__actions { display: flex; gap: var(--space-3); flex-wrap: wrap; justify-content: center; }
```

- [ ] **Step 5: Teste dos overlays** — `tests/app/gameover-overlay.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { GameOverOverlay } from '../../src/app/game/GameOverOverlay';

describe('GameOverOverlay', () => {
  it('renderiza stats + botões e chama Reiniciar', () => {
    const onRestart = vi.fn();
    const host = document.createElement('div');
    render(<GameOverOverlay stats={{ distance: 100, food: 3, nearMisses: 1, score: 50, coins: 3, newRecord: true }} onRestart={onRestart} onQuit={() => {}} />, host);
    expect(host.querySelector('[data-testid="gameover-record"]')).not.toBeNull();
    (host.querySelector('[data-testid="gameover-restart"]') as HTMLButtonElement).click();
    expect(onRestart).toHaveBeenCalledOnce();
  });
  it('sem badge de recorde quando newRecord=false', () => {
    const host = document.createElement('div');
    render(<GameOverOverlay stats={{ distance: 1, food: 0, nearMisses: 0, score: 1, coins: 0, newRecord: false }} onRestart={() => {}} onQuit={() => {}} />, host);
    expect(host.querySelector('[data-testid="gameover-record"]')).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar + commit**

Run: `npx vitest run tests/app/gameover-overlay.test.tsx && npm run check && npm test`
Expected: verde.
```bash
git add src/app/game/GameOverOverlay.tsx src/app/game/ReadyPrompt.tsx tests/app/gameover-overlay.test.tsx src/app/screens/PlayScreen.tsx src/app/styles/global.css
git commit -m "feat(ui-w3): GameOverOverlay + ReadyPrompt DOM + PlayScreen poll"
```

---

### Task 3: GameScene esconde o Game Over/ready in-canvas

**Files:**
- Modify: `src/render/GameScene.ts`

- [ ] **Step 1: Flag + esconder** — em `GameScene`, adicionar campo `private domOverlays = true;`. Em `syncGameOver()`, no início: `if (this.domOverlays) { this.gameOverBg.setVisible(false); this.gameOverTitle.setVisible(false); this.gameOverStats.setVisible(false); this.gameOverRestart.setVisible(false); this.gameOverQuit.setVisible(false); return; }`. E onde `this.readyPrompt.setVisible(match.phase === 'ready')` (no `update`), trocar por `this.readyPrompt.setVisible(!this.domOverlays && match.phase === 'ready');`. (A criação dos objetos permanece — inerte; o `pauseOverlay` dim e o HUD ficam.)

- [ ] **Step 2: Tipos + suíte**

Run: `npm run check && npm test`
Expected: verde (o gameover in-canvas some; DOM assume). Determinismo intocado.

- [ ] **Step 3: Commit**

```bash
git add src/render/GameScene.ts
git commit -m "feat(ui-w3): GameScene esconde Game Over/ready in-canvas (DOM assume)"
```

---

### Task 4 (controlador, inline): validação + docs

- [ ] **Step 1:** `npm run build` + `npx vite preview`; Playwright **1366×768**: jogar (tap + flaps) até morrer ⇒ **diálogo DOM** emoldurado (título ourado + 📍/🍖/⚠️ stats + 🪙 moedas + NOVO RECORDE quando bater); **Reiniciar** → volta a jogar (canvas ativo, ready); **ready** mostra o prompt DOM. Screenshot do Game Over.
- [ ] **Step 2:** Confirmar que o texto pixelado in-canvas SUMIU (só o diálogo DOM). Ciclo morte→overlay→restart OK. **390×844** idem.
- [ ] **Step 3:** Atualizar `CLAUDE.md` (W3 feita; W4 restante). Commit.

**Gotcha (7.2/8.3):** SW serve dist antigo — `unregister()` + limpar caches + `?nocache`.

## Self-Review

- **Cobertura:** ponte+i18n (T1) ✓; overlays DOM+PlayScreen poll (T2) ✓; GameScene esconde (T3) ✓; validação+docs (T4) ✓; core intocado ✓.
- **Placeholders:** nenhum (valores de CSS/insets ajustáveis na T4).
- **Consistência:** `GameHandle`/`MatchSnapshot`/`GameOverStats` (T1) consumidos por PlayScreen/overlays (T2); `formatGameOverStats` reusado; `--ui-panel` p/ a moldura do diálogo; `domOverlays` (T3) esconde o in-canvas sem tocar o ciclo de partida (2.6).
