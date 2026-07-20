# UI W4: HUD DOM + pausa DOM — Implementation Plan

> Executado INLINE pelo controlador (sessão longa; subagentes vinham caindo por limite). Deliverables idênticos ao spec `2026-07-20-ui-w4-hud-pause-dom-design.md`.

**Goal:** HUD in-game crisp em DOM + pausa como overlay DOM; sai o texto monospace pixelado do canvas.

**Constraints:** `src/core/` intocado ⇒ det 67; i18n nos 10 locales; sem dep nova.

## Tarefas

### T1 — Ponte + i18n
- `startGame.ts`: `MatchSnapshot` ganha `hud: HudLive | null` (`{distance,food,level,speed,weather,seed}` de `match.world`+`seedLabel`, ou null se sem partida). Tipos exportados.
- i18n `pause.title`/`pause.resume` nos 10 locales.

### T2 — Componentes DOM + PlayScreen
- `src/app/game/Hud.tsx`: recebe `{distance,food,level,speed,weather,seed,fps}`; reusa `formatHudValues`+i18n (`hud.*`, `weather.*`); painel discreto top-left `pointer-events:none`.
- `src/app/game/PauseOverlay.tsx`: `pause.title`+`pause.resume`, `pointer-events:none`, dim.
- `PlayScreen`: no laço rAF — (a) atualiza `snap` (fase/pausa/gameover) **só quando muda** (gate, fecha o Minor do W3); (b) mede fps (delta) e atualiza o estado do HUD **~5 Hz**; renderiza `<Hud>` (fase playing) e `<PauseOverlay>` (paused).
- `global.css`: `.hud`/`.pause-overlay`.
- Testes leves happy-dom p/ Hud + PauseOverlay.

### T3 — GameScene esconde HUD in-canvas
- `hudText.setVisible(false)` sob `domOverlays`; `refreshHud` early-return sob a flag. (dim de pausa in-canvas permanece; o texto DOM entra por cima.)

### T4 — Validação (Playwright) + docs + merge.

## Self-review
Core intocado; `formatHudValues` reusado; `domOverlays` (W3) reusado p/ esconder o HUD; gate do rAF fecha o Minor do W3.
