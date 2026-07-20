# Design — UI W4: HUD limpo (DOM) + pausa DOM

**Data:** 2026-07-20
**Contexto:** W1–W3 aproximaram os menus e o Game Over do conceito. Restam, no canvas do jogo, dois
elementos de **texto monospace pixelado**: o **HUD** (Dist/Food/FPS/Lv/Speed/Seed/Weather, top-left,
poluído) e o **dim de pausa** (sem texto). W4 (última frente) move ambos para **DOM** limpo. Personagem
pterodáctilo e transições de tela ficam backlog (art-dependentes / menor prioridade). `src/core/` NÃO é
tocado ⇒ **det 67**.

## Componentes

### 1. Ponte: `snapshot` expõe stats do mundo (`startGame.ts`)

`MatchSnapshot` ganha `hud: HudLive | null`: quando há partida (`world` existe), `{ distance, food,
level, speed, weather, seed }` lidos de `match.world` + `match.seedLabel`. (O `fps` NÃO vem daqui — é
medido no `PlayScreen`, ver abaixo, evitando expor o `HudTicker` do GameScene.) Reusa `WorldState`
(read-only). Sem custo por frame no jogo (getters).

### 2. HUD DOM (`src/app/game/Hud.tsx` + PlayScreen)

- `Hud` (Preact): recebe `{ distance, food, level, speed, weather, seed, fps }`; renderiza via
  `formatHudValues`/`i18n` (reusa `@render/hud` + as chaves `hud.*` já existentes) num painel discreto
  top-left (semi-transparente, `pointer-events:none`, `font` do app — crisp, não pixelado).
- `PlayScreen`: mede **fps** no próprio laço rAF (delta suavizado) e passa `hud + fps` ao `<Hud>`, só
  na fase `playing` (some em ready/dead — o Game Over já mostra os totais). Atualização throttled a
  ~5 Hz p/ o HUD (contador no rAF) enquanto fase/pausa/gameover continuam imediatos (evita re-render
  60 Hz do subtree — fecha o Minor do W3).

### 3. Pausa DOM (`src/app/game/PauseOverlay.tsx` + PlayScreen)

- `PauseOverlay` (Preact): visível quando `snap.paused`; dim + título `pause.title` (i18n novo) + dica
  para retomar (`pause.resume`), `pointer-events:none` (o toque/tecla retoma via os controls
  existentes). Centralizado sobre o canvas.
- `GameScene`: esconde o **HUD in-canvas** (mesma flag `domOverlays`: `hudText.setVisible(false)`; o
  `refreshHud` vira no-op sob a flag). O **dim de pausa in-canvas** pode permanecer (dim) ou ser
  escondido em favor do DOM — manter o dim in-canvas (barato) + o texto DOM por cima.

## i18n

2 chaves novas nos 10 locales (REGRA 4): `pause.title` ("Pausado"), `pause.resume` ("Toque para
retomar"). Reusa `hud.*`.

## Testes

- `Hud`/`PauseOverlay`: teste leve happy-dom (renderiza os campos; pausa condicional).
- i18n: paridade + scanner AST verdes (2 chaves × 10).
- Determinismo: **67** (core intocado).
- Playwright (build prod 1366×768): em partida, **HUD DOM** crisp top-left (Dist/Food/Lv/Speed/Seed/
  Weather + FPS), não o monospace pixelado; pausar (P/Esc) ⇒ **overlay DOM "Pausado"**; retomar
  volta ao jogo. Mobile idem.

## Fora de escopo (backlog)

- **Personagem pterodáctilo** nas telas (conceito tem à esquerda) — precisa de arte dedicada
  transparente; adiar.
- **Transições de tela** (fade/slide entre rotas) — polish adicional.
- Ícones de stat dourados no Game Over (hoje emoji); painel de dino ativo no Ninho (W2b); stat-chips
  no topo das sub-telas (W2b).

## Riscos

- **fps no PlayScreen:** medir por delta de rAF (média móvel curta) — evita expor o `HudTicker`.
- **Throttle do HUD:** ~5 Hz p/ o HUD, imediato p/ fase/pausa — cuidar p/ o Game Over/ready não
  atrasarem.
- **HUD in-canvas escondido:** o `HudTicker`/`refreshHud` permanecem (inertes) — sem tocar o ciclo.
