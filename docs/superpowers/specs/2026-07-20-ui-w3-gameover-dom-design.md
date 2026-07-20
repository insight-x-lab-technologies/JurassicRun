# Design — UI W3: Game Over (+ ready) como overlay DOM

**Data:** 2026-07-20
**Contexto:** o conceito (`ref/ref_GameOver.png`) mostra o Game Over como um **diálogo emoldurado
rico** (título ourado, stats com ícones, badges "NOVO RECORDE"/"+N Moedas", botões 9-slice). O atual
(`ref/print_GameOver.png`) é **texto cru no canvas Phaser 320×180** (pixelado, sem estilo). W3 move
Game Over e o prompt de "ready" para **overlays DOM** (React) por cima do canvas, estilizados como as
outras telas. Frente 3 de 4 (autônomo). `src/core/` NÃO é tocado ⇒ **det 67**.

## Ponte Phaser → React (chave)

O estado da partida vive no `MatchController` (dentro do closure de `startGame`). Para o `PlayScreen`
(DOM) ler fase + stats:
- `startGame(container, mode)` passa a retornar **`{ stop, snapshot, restart }`** (hoje só `() => void`):
  - `snapshot(): { phase, paused, gameOver? }` — lê `match.phase` + `pause.paused` + o `gameOver`
    guardado.
  - `restart(): void` = `match.restart()`.
- No hook `onGameOver`, guardar `lastGameOver = { distance, food, nearMisses, score, coins, newRecord }`:
  - `coins = coinsForFood(w.food)` (o valor já creditado).
  - `newRecord` = `w.score > (melhor score corrente do modo)` — calculado **antes** de
    `leaderboardService.recordMatch` (lê `leaderboardService.{endless|daily|weekly}.value[0]?.score`).
- **`PlayScreen`** roda um laço `requestAnimationFrame` enquanto montado que chama `snapshot()` e
  guarda em `useState`; renderiza os overlays conforme a fase. Cancela o rAF no cleanup. (Poll de um
  compare de string por frame — barato, fora do hot path do jogo; REGRA 3 do render não é afetada.)

## Componentes DOM

### `GameOverOverlay` (`src/app/game/GameOverOverlay.tsx`)
Visível quando `phase==='dead'`. Diálogo emoldurado (painel `--ui-panel` 9-slice), **pointer-events
auto**:
- Título ourado (`gameover.title`, reusa o estilo `.screen__title`).
- 3 stats com glifo + valor: 📍 `gameover.distance`, 🍖 `gameover.food`, ⚠️ `gameover.nearMisses`
  (floor via `formatGameOverStats` de `@render/gameover`, reusado).
- Badge **NOVO RECORDE** (`gameover.newRecord`) só quando `newRecord`.
- Badge **moedas** (`gameover.coinsEarned` com `{value}`).
- Botões: **Reiniciar** (`.btn`) → `restart()`; **Sair** (`.btn--ghost`) → `back()` (volta ao menu).

### `ReadyPrompt` (`src/app/game/ReadyPrompt.tsx`)
Visível quando `phase==='ready'`. Texto central `match.tapToStart`, **`pointer-events:none`** (o tap
passa para o canvas/controls e inicia a partida, como a dica de girar do 7.2).

### Posição
Ambos absolutos dentro de `.play-screen` (que já é `position:relative`), acima do canvas
(`.play-screen__canvas` inset:0). O GameOver centralizado; o ReadyPrompt centralizado.

## GameScene — esconder o in-canvas (baixo risco)

Em vez de remover a lógica de Game Over/ready (entrelaçada com o ciclo de partida, 2.6), **desativar
a exibição**: os objetos `gameOverBg/Title/Stats/Restart/Quit` e `readyPrompt` deixam de ficar
visíveis (nunca `setVisible(true)`), guardados por uma flag `private domOverlays = true`. `syncGameOver`
vira no-op (ou early-return sob a flag); a criação pode permanecer (inerte) para minimizar a cirurgia.
O **restart por teclado** (`bindGameControls` `onRestart`/`isDead`, controls.ts) **permanece** (Space/
Enter reiniciam), e o botão DOM Reiniciar também chama `restart()`. O **dim de pausa** in-canvas
permanece (pausa DOM fica p/ W4). Mundo/HUD/parallax intactos.

## i18n

Duas chaves novas nos 10 locales (REGRA 4, skill `add-locale`): `gameover.newRecord` ("Novo recorde!"),
`gameover.coinsEarned` ("+{{value}} moedas"). Reusa `gameover.{title,distance,food,nearMisses,restart,
quit}`.

## Testes

- `startGame` bridge: sem teste de unidade direto (casca com Phaser). O `snapshot`/`restart` são
  finos; validados no Playwright.
- Componentes `GameOverOverlay`/`ReadyPrompt`: teste leve happy-dom (renderiza título/stats/botões;
  Reiniciar chama o callback; badge de recorde condicional).
- i18n: paridade + scanner AST verdes (as 2 chaves nos 10 locales).
- Determinismo: **67** (core intocado).
- Playwright (build prod, **1366×768**): jogar até morrer ⇒ **diálogo DOM** emoldurado com título
  ourado + 3 stats + badge de moedas (+ NOVO RECORDE quando bater recorde) + Reiniciar/Sair; **clicar
  Reiniciar** volta a jogar (fase ready, canvas ativo); **ready** mostra o prompt DOM e o tap inicia.
  Sem regressão do ciclo (morte → overlay → restart). Mobile 390 idem.

## Fora de escopo (W4/W2b)

- HUD in-game restyle (W4); pausa como overlay DOM (W4); personagem/transições (W4); stats extras no
  Game Over (clima/seed com ícones — o HUD já mostra seed/clima); painel de dino ativo (W2b).

## Riscos

- **Ciclo de partida:** manter a lógica in-canvas (só escondida) minimiza risco de quebrar o
  restart/2.6. Validar morte→overlay→restart no Playwright.
- **rAF poll no PlayScreen:** garantir cancelamento no unmount (sem leak). O poll não deve tocar o
  loop do jogo (só lê `snapshot`).
- **Sair (back):** volta uma tela na pilha; do Play chega ao menu de origem. Coerente com o botão
  Voltar existente.
