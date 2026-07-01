# Spec — 2.4 HUD (vertical slice Endless)

Data: 2026-07-01 · Fase 2 · Item 2.4 · Modo autônomo (decisões tomadas pelo agente).

## Objetivo

Sobrepor à cena um HUD de leitura em tempo real da partida: **distância, comida (moedas),
fps, nível, velocidade do dino e seed em execução**, com **atualização throttled** que não
custe fps. Puramente informativo; não altera a simulação (REGRA 1) nem aloca no hot path
por frame (REGRA 3). Nenhuma string hardcoded — tudo via i18n (REGRA 4).

## Escopo

Inclui:
- Módulo PURO testável (`src/render/hud.ts`, sem `phaser`) com: o ticker de throttle+fps e a
  formatação dos valores.
- Casca Phaser (`GameScene`) que cria os textos e os atualiza throttled com rótulos i18n.
- Chaves i18n `hud.*` nos 10 locales.
- Plumbing da **seed** de exibição (`GameDeps.seedLabel` → `GameScene`).

NÃO inclui (fora do item):
- Fluxo de partida / seed aleatória real e reinício (**2.5**).
- Game Over overlay com estatísticas (**2.6**).
- Object pooling / culling / medição formal de fps mobile (**2.7**).
- Rótulo textual de pausa (segue adiado para 2.6, coerente com 2.2/2.3).
- Tocar `src/core/` — o core NÃO é alterado; a seed continua não fazendo parte do `WorldState`.

## Arquitetura (segue o padrão 2.1–2.3: puro × casca)

### Módulo puro — `src/render/hud.ts`

Sem import de `phaser`. Testado em env node. Exporta:

1. **`HudTicker`** — throttle de refresh + medidor de fps numa só peça (janela de tempo).
   - `constructor(intervalSeconds = HUD_REFRESH_INTERVAL)`.
   - `tick(dtSeconds: number): number | null` — chamado 1×/frame (alocação-zero: só escalares).
     Acumula `dt` e conta frames. Enquanto a janela `< interval`, retorna `null` (sem refresh).
     Ao cruzar `interval`: computa `fps = frames / elapsed`, **reseta** janela e retorna o fps.
   - Racional: o próprio gate de throttle produz o fps (frames ÷ tempo decorrido) ⇒ uma peça,
     zero estado extra, fps naturalmente suavizado sobre a janela.
2. **`formatHudValues(raw: HudRaw): HudView`** — formatação pura → strings de valor (sem i18n;
   rótulos/unidades vão nas chaves i18n). Arredondamentos canônicos:
   - `distance` → `Math.floor` (inteiro).
   - `food` → inteiro (já é).
   - `fps` → `Math.round`.
   - `level` → inteiro.
   - `speed` (velocidade de scroll efetiva) → `Math.round`.
   - `seed` → string como está.
   - `HudRaw = { distance, food, fps, level, speed: number; seed: string }`.
   - `HudView = { distance, food, fps, level, speed, seed: string }`.

`HUD_REFRESH_INTERVAL` (constante, `0.2` s ⇒ ~5 Hz) fica em `hud.ts` ou `constants.ts`.

### Casca — `GameScene` (Phaser, sem teste de unidade)

- `create()`: cria **um** `Phaser.Text` multilinha (ou N linhas — decidir na implementação;
  default: um único text multilinha, mais barato) no canto superior-esquerdo,
  `setScrollFactor(0)`, `setDepth(900)` (acima do mundo/parallax, **abaixo** do overlay de
  pausa em 1000). Fonte bitmap default do Phaser, tamanho pequeno legível no canvas 320×180.
- `update()` (só no ramo NÃO-pausado, como parallax em 2.3): chama `ticker.tick(dt)`. Se
  retornar `null`, não faz nada (não reconstrói texto ⇒ sem alocação de string por frame). Se
  retornar `fps`, monta as linhas: para cada campo, `i18n.t('hud.<campo>', { value })` com o
  `HudView` de `formatHudValues({ ...world, fps, speed: world.scrollSpeed, seed })`, e faz
  `text.setText(linhas)`. Refresh ~5×/s ⇒ custo de string desprezível, fora do hot path.
- Durante a pausa o HUD permanece com o último valor (cena congelada), coerente com 2.2/2.3.
- **Fonte dos dados**: `world.distance`, `world.food`, `world.level`, `world.scrollSpeed`
  (lidos por referência a cada refresh), `fps` do ticker, `seed` do `seedLabel` injetado.

### Plumbing da seed

- `GameDeps` (em `game.ts`) ganha `seedLabel?: string` (default `''`). Repassado ao
  `GameScene`. `main.ts` extrai a seed para uma const e passa a mesma para `createWorld` e para
  `createGame`. 2.5 substituirá por seed aleatória exibível.

## i18n — chaves `hud.*` (10 locales)

Namespace `hud`, cada chave com `{{value}}` interpolado (rótulo/unidade localizáveis):
- `hud.distance` (ex. en: `"Dist: {{value}}m"`)
- `hud.food` (`"Food: {{value}}"`)
- `hud.fps` (`"FPS: {{value}}"`)
- `hud.level` (`"Lv {{value}}"`)
- `hud.speed` (`"Speed: {{value}}"`)
- `hud.seed` (`"Seed: {{value}}"`)

Adicionadas em todos os 10 arquivos via skill `add-locale`. Sem string visível hardcoded.

## Testes

- `src/render/hud.test.ts` (env node, puro):
  - `HudTicker.tick`: retorna `null` antes da janela; ao cruzar `interval` retorna `fps` ≈
    `frames/elapsed` (ex.: 12 frames de `1/60`s em 0.2s ⇒ 60 fps); reseta e recomeça; janela
    grande (aba em background) não estoura.
  - `formatHudValues`: floor de distância, round de fps/speed, seed passthrough.
- Casca não tem teste de unidade — verificação **visual via Playwright** (padrão 2.1–2.3):
  os 6 campos aparecem, atualizam ao jogar, e a seed exibida bate com a config.
- Guardas de suíte inteira: `npm run check` limpo, `npm test` verde, determinismo intacto
  (core não tocado ⇒ 54 testes de determinismo seguem verdes).

## Riscos / decisões

- **fps no render, não no core** — correto: fps é propriedade do laço de apresentação, não da
  simulação de passo fixo (que é fps-independente por contrato).
- **Alocação por frame** — evitada pelo throttle: `tick(dt)` é escalar; `setText` só no
  refresh (~5 Hz). Coerente com REGRA 3.
- **Seed fora do `WorldState`** — mantida fora do core (o core não conhece a string de seed);
  exibição recebe o rótulo por injeção. Sem violar determinismo.
- **Unidades** (`m`, arredondamentos) — cosméticas, ancoradas nas chaves i18n; ajustáveis sem
  tocar lógica.
</content>
</invoke>
