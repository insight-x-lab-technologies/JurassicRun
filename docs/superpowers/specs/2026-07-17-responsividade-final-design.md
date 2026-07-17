# 7.2 — Responsividade final (design)

> Fase 7, item 7.2. Fecha a responsividade transversal validada desde a Fase 2.
> **Nada em `src/core/`** ⇒ determinismo 67 intacto (sem re-pin de goldens).

## Objetivo

O jogo funciona e fica legível em **desktop, tablet e celular**, em **retrato e paisagem**,
em vários tamanhos. O canvas do jogo escala/letterbox corretamente e a UI respeita as
safe-areas (notch/barras do sistema). Zero scroll horizontal em qualquer alvo.

## Princípio de arquitetura (inegociável)

O **campo lógico do jogo é fixo em 320×180** (16:9). NÃO muda por dispositivo/orientação —
isso é exigência de determinismo e de **justiça de leaderboard** (todos jogam exatamente o
mesmo campo; desafios Diário/Semanal precisam ser reproduzíveis). Logo a resposta correta a
telas variadas é **escalar+letterbox** o campo fixo, nunca redimensionar o mundo. Isso já é
o que `Phaser.Scale.FIT` + `CENTER_BOTH` fazem em `src/render/game.ts`; 7.2 valida e fecha as
lacunas ao redor, não reescreve a estratégia de escala.

Consequência de produto: em **celular retrato**, um campo 16:9 vira uma faixa fina no meio da
tela. Decisão (do usuário): mostrar uma **dica suave de girar para paisagem** que **não bloqueia
o jogo** — o jogador ainda pode tocar/flapar por baixo dela; ela some sozinha ao girar.

## Escopo (4 frentes)

### 1. Canvas / letterbox
- Manter `Scale.FIT` + `autoCenter: CENTER_BOTH`, campo 320×180. Sem mudança de estratégia.
- As **barras de letterbox** (área fora do canvas) devem ficar na cor de fundo do tema
  (`--color-bg` = `#0e1116`, que casa com o `<meta name="theme-color">`), para não haver
  “moldura” destoante. Hoje o `#app` já tem esse fundo; garantir que a `.play-screen` não
  introduza cor diferente e que o canvas centralizado deixe as barras nessa cor.
- **Safe-areas:** o `#app` já aplica `padding: env(safe-area-inset-*)` (com `viewport-fit=cover`
  no `index.html`). Confirmar que o botão **Voltar** (`.play-screen__back`, absoluto top/left)
  cai **dentro** da safe-area em paisagem com notch à esquerda — ele é filho de `#app`, então
  herda a área, mas o `position:absolute` é relativo à `.play-screen`; validar/ajustar o offset
  para respeitar `env(safe-area-inset-left/top)` quando a `.play-screen` encostar na borda.

### 2. Dica de girar (rotate hint)
Padrão puro×casca, escopada **só à PlayScreen** (o side-scroller; os menus são responsáveis
por si em retrato e não precisam de dica).

- **Puro** (`src/render/orientation.ts`, testável, sem DOM): `shouldSuggestRotate({ portrait,
  coarsePointer }): boolean` = `portrait && coarsePointer`. (Só sugere em toque + retrato;
  desktop retrato/janela estreita não recebe.) Sem `window`/`matchMedia` dentro — recebe os
  fatos já lidos.
- **Casca** (hook/efeito na PlayScreen): assina `window.matchMedia('(orientation: portrait)')`
  e `window.matchMedia('(pointer: coarse)')`, recomputa `shouldSuggestRotate` na mudança,
  guarda o estado num sinal/`useState`, e limpa os listeners no unmount.
- **UI:** overlay dentro da `.play-screen`, visível só quando o hook retorna `true`. Regras:
  - `pointer-events: none` (NÃO bloqueia o flap/tap que passam para o canvas).
  - Ícone de rotação (emoji `📱`/glyph, decorativo `aria-hidden`) + texto i18n `rotateHint.message`.
  - Centralizado, semitransparente sobre o letterbox; depth/z acima do canvas.
  - Some automaticamente em paisagem (o hook vira `false`).
- **i18n:** chave nova `rotateHint.message` nos 10 locales (REGRA 4). Usar a skill `add-locale`
  se disponível; senão traduções à mão + allowlist justificada, mantendo paridade e o scanner
  AST verdes.

### 3. Menus em paisagem curta / tamanhos extremos
- Telas de menu usam `.screen`/`.home`/etc. com `justify-content: center` e `flex: 1`. Em
  **paisagem baixa de celular** (~≤430px de altura) ou telas com muito conteúdo (Configurações,
  Leaderboard, Ninho), o conteúdo centralizado pode **clipar** (sem como rolar). Corrigir:
  contêineres roláveis que permitam `overflow-y: auto` e caiam para `justify-content: flex-start`
  quando o conteúdo não couber, **sem** quebrar a centralização quando couber (ex.: `justify-content:
  safe center` onde suportado, ou padding + `overflow-y:auto` no wrapper de rolagem).
- Garantir **zero scroll horizontal** em qualquer largura (checar grids `auto-fit`, `min-width`
  de botões, `.leaderboard__row`, chips que quebram linha).
- Alvos de toque ≥44px preservados (já convencionado); nada de regressão.

### 4. Validação (Playwright, evidência real)
Rodar o bundle real e capturar screenshots + checagens em uma **matriz**:

| Alvo | Tamanho | Orientação | O que provar |
|------|---------|-----------|--------------|
| Celular | 390×844 | retrato | Home responsiva; Play mostra dica de girar; sem scroll-x |
| Celular | 844×390 | paisagem | Play sem dica; canvas letterbox centrado; menus roláveis sem clip |
| Tablet | 768×1024 | retrato | grids reflowam; sem scroll-x |
| Tablet | 1024×768 | paisagem | canvas grande centrado; UI ok |
| Desktop | 1440×900 | — | canvas centrado com barras na cor do tema; menus centrados |
| Notch | 390×844 + insets | — | Voltar/HUD fora da safe-area |

Checagens automatizáveis: `document.documentElement.scrollWidth <= clientWidth` (sem scroll-x);
dica de girar presente/ausente conforme orientação; canvas presente e centralizado.

## O que NÃO está no escopo (YAGNI)
- Redimensionar o mundo lógico por dispositivo (proibido — determinismo/justiça).
- Fullscreen API / lock de orientação real do browser (não confiável; a dica basta).
- Arte/tema das barras de letterbox além da cor sólida do tema (Fase 8).
- Reescrever a estratégia de escala do Phaser.

## Testes
- **Unidade (Vitest):** `orientation.ts` — `shouldSuggestRotate` para as 4 combinações
  (portrait×coarse). Puro, trivial de cobrir.
- **i18n:** paridade das 10 chaves `rotateHint.message` + scanner AST de strings hardcoded
  continuam verdes.
- **Determinismo:** inalterado (nada em `src/core/`); a bateria de 67 deve seguir verde por
  não-regressão, sem re-pin.
- **E2E:** Playwright conforme a matriz acima (evidência de fechamento, não CI).

## Definição de pronto
`npm run check` limpo, `npm test` verde (incluindo o teste novo de `orientation` e a paridade
i18n), determinismo 67 intacto, e a matriz Playwright capturada mostrando canvas letterbox
correto + dica de girar + safe-areas + zero scroll horizontal.
