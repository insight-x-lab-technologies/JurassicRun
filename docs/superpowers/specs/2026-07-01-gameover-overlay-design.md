# Spec 2.6 — Game Over overlay (básico)

> Fase 2 (vertical slice Endless), item 2.6. Ver `docs/roadmap/PHASE-02-endless-vertical-slice.md`.
> Segue o padrão puro×casca das telas anteriores (2.4 HUD, 2.5 fluxo de partida).

## Objetivo

Quando a partida entra em `dead`, mostrar um overlay de Game Over com as **estatísticas da
run** (distância, comida, near-misses) e **dois botões**: **Reiniciar** (ativo) e **Sair**
(stub desabilitado, ativa na Fase 4). O core não é tocado (REGRA 1): a morte, as contagens e o
reinício-do-zero já vêm das Fases 1.6/1.7/2.5.

## Decisões de produto/escopo

- **Botão "Sair": stub desabilitado.** Não há menu/home até a Fase 4, então "Sair" não tem
  destino. Fica **visível porém desabilitado** (acinzentado, sem hit-test), sinalizando a
  intenção. Ligar ao menu é trabalho da Fase 4.
- **Restart passa a ser dirigido pelo botão** (não mais "tap em qualquer lugar"). Consequência
  direta do Sair desabilitado: se um toque em qualquer lugar reiniciasse, o Sair não estaria de
  fato inerte. Reiniciar dispara por: toque/clique no botão **Reiniciar** OU tecla de
  confirmação (Space/ArrowUp/Enter) enquanto em `dead` (conveniência desktop).

## Arquitetura (puro × casca)

Espelha 2.4/2.5. Lógica testável isolada em módulos puros (env node, sem `phaser`); a
renderização vive na casca Phaser (`GameScene`), verificada visualmente (Playwright).

### 1. `src/render/gameover.ts` — PURO (novo)

Formatação canônica das estatísticas, no molde de `formatHudValues` (hud.ts):

```ts
export interface GameOverRaw { distance: number; food: number; nearMisses: number; }
export interface GameOverView { distance: string; food: string; nearMisses: string; }
export function formatGameOverStats(raw: GameOverRaw): GameOverView;
```

- `distance`/`food`/`nearMisses` → `String(Math.floor(...))` (contagens inteiras; `distance`
  é metros como no HUD). Rótulos/unidades vivem nas chaves i18n `gameover.*`.
- Sem estado, sem alocação por frame (chamado 1× ao entrar em `dead`).

### 2. `src/render/match.ts` — `MatchController` (refino)

Hoje `notifyFlap()` acumula dois significados (`ready→playing` e `dead→restart`). Separar
para que o restart tenha um gatilho explícito (o botão), não o flap genérico:

- `notifyFlap()`: passa a tratar **apenas** `ready → playing` (no-op em `playing`/`dead`).
- `restart()` (novo): **apenas** em `dead` monta nova partida (nova seed/world via `factory`)
  e dispara `hooks.onNewMatch?.()`. No-op fora de `dead`.

`onNewMatch` (reset do `FlapInputSource`) continua garantindo que o toque de restart não vire
o 1º flap da nova partida. Os testes de 2.5 que exercitam `notifyFlap` em `dead` migram para
`restart()`.

### 3. `src/render/GameScene.ts` — casca (overlay)

Objetos criados 1× em `create()`, escondidos por default. No `update()`:

- **Visibilidade** do grupo Game Over = `match.phase === 'dead'`, atualizada tanto no ramo
  pausado quanto no não-pausado (como o `pauseOverlay`), para refletir a fase mesmo sob pausa.
- **Refresh das estatísticas 1× na transição** para `dead` (rastreado por um `wasDead: boolean`),
  não por frame ⇒ **zero alocação de string no hot path** (REGRA 3). Enquanto `dead`, o
  `update` só faz `setVisible` (a sim está congelada; o último frame permanece desenhado atrás).

Conteúdo do overlay (tudo `setScrollFactor(0)`):

- Retângulo escuro de tela cheia (reusa `PAUSE_OVERLAY_COLOR`/um alpha próprio de Game Over).
- Título `gameover.title` (centralizado, topo).
- 3 linhas de estatística via `i18n.t('gameover.<campo>', { value })` sobre
  `formatGameOverStats` lido do `world` por referência (`distance`, `food`, `nearMisses`).
- Botão **Reiniciar**: `Text` interativo (`setInteractive({ useHandCursor: true })`), com um
  retângulo de fundo (alvo de toque mobile). `pointerdown` → `match.restart()`.
- Botão **Sair**: `Text` acinzentado, **não** interativo (stub desabilitado).

**Teclado (desktop):** em `create()`, um listener de `keydown` da cena; se `match.phase ===
'dead'` e o code ∈ {Space, ArrowUp, Enter}, chama `match.restart()`. Fica ao lado do fluxo
global (`bindGameControls`), que segue chamando `notifyFlap` (agora no-op em `dead` ⇒ toque em
espaço vazio ou no Sair não reinicia).

### 4. i18n — `src/i18n/locales/*.json` (REGRA 4)

Novas chaves `gameover.*` nos **10 locales** (paridade garantida por
`tests/i18n/locales.test.ts`), via skill `add-locale`:

- `gameover.title` — ex. "Game Over"
- `gameover.distance` — ex. "Distance: {{value}}m"
- `gameover.food` — ex. "Food: {{value}}"
- `gameover.nearMisses` — ex. "Near misses: {{value}}"
- `gameover.restart` — ex. "Restart"
- `gameover.quit` — ex. "Quit"

### 5. `src/render/constants.ts` — profundidades e estilo

- `GAMEOVER_OVERLAY_DEPTH` (fundo escuro) e `GAMEOVER_CONTENT_DEPTH` (título/stats/botões),
  entre o HUD (900) e o overlay de **pausa** (1000) — assim, se pausar sobre a tela de morte,
  a pausa cobre por cima. `ready` (950) e `dead` são fases mutuamente exclusivas ⇒ sem conflito.
- Constantes de layout/estilo (posições, fontes, cores dos botões, alpha do fundo, `CONFIRM_KEYS`).

## Fluxo de dados

`step` do core (Fase 1) atualiza `world.{distance,food,nearMisses}` → na transição para `dead`,
`GameScene` lê esses campos por referência, formata via `formatGameOverStats`, monta as linhas
i18n e mostra o overlay. **Nada volta para o core.** `restart()` no `MatchController` troca o
`WorldState`/`FixedStepLoop` da partida (nova seed) e a cena volta a `ready`.

## Determinismo

`src/core/` **não é tocado**. Só camada de render/estado de UI. A bateria de determinismo (54)
deve permanecer intacta. Não roda `verify-determinism` como gate de core, mas a suíte cheia
confirma que nada regrediu.

## Testes

- **`gameover.ts` (puro):** `formatGameOverStats` — floor de distância/comida/near-misses,
  strings corretas, valores fracionários truncados, zeros.
- **`MatchController` (puro):** `notifyFlap` só faz `ready→playing` (no-op em `dead`);
  `restart()` só age em `dead` (monta nova partida + dispara `onNewMatch`; no-op em
  `ready`/`playing`). Atualizar os testes de 2.5 que assumiam restart via `notifyFlap`.
- **Casca `GameScene`:** sem teste de unidade (Phaser). **Verificação visual** via Playwright:
  morrer → overlay aparece com as 3 estatísticas corretas; **Reiniciar** volta ao `ready`
  (prompt "Tap to start"); **Sair** não faz nada; toque em espaço vazio não reinicia; a sim
  fica congelada atrás do overlay.

## Não-objetivos (fora do 2.6)

- Menu/home e destino real do "Sair" (Fase 4).
- Score final, high-score, persistência, compartilhar (Fases 3/4).
- Animações/transições do overlay, arte de botões (cosmético; Fase 8).
- Object pooling/culling e medição de fps (item **2.7**).

## Definição de pronto

`npm run check` limpo, `npm test` verde (incluindo os novos testes puros e paridade i18n),
determinismo (54) intacto, e verificação visual do overlay/reiniciar/sair confirmada.
