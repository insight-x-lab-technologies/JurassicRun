# Spec — 4.1 App shell e navegação (Preact)

**Fase 4 (Meta offline), item 4.1.** Data: 2026-07-04.

## Objetivo

Estabelecer a casca de aplicação (app shell) em Preact que hospeda **telas** navegáveis e os
**design tokens responsivos** que todas as telas da Fase 4 vão consumir. Hoje `src/app/main.ts`
entra direto no jogo Phaser, sem shell nem navegação. Este item cria a fundação de UI da qual os
demais itens da fase (Home 4.3, Perfil 4.2, Ninho 4.4, Loja 4.5, Expansões 4.6, Configurações
4.8, Leaderboard) dependem.

**Não-objetivos (ficam em itens/fases posteriores):**
- Conteúdo real das telas (menu Home completo, perfil, ninho, loja, etc.) — 4.2–4.10.
- Troca de idioma ao vivo com re-render — a *seam* fica pronta; o disparo é 4.8.
- Roteamento por URL/hash e deep-link para PWA/back-button do browser — Fase 7.
- Persistência (perfis, carteira) — 4.2/4.5.
- Áudio, transições animadas entre telas — 4.10 / Fase 8.

## Regras do projeto que se aplicam

- **REGRA 4 (i18n):** nenhuma string visível hardcoded — rótulos de navegação e títulos de tela
  via chaves i18next nos 10 locales.
- **REGRA 3 (performance):** o shell não roda no hot path do jogo; ainda assim, montar/desmontar o
  Phaser deve ser limpo (sem leak de `Game` nem de listeners).
- **`src/core/` NÃO é tocado** ⇒ contrato de determinismo intacto (nenhuma preocupação de
  determinismo neste item; é UI pura).
- Padrão **puro × casca** (como `src/render/`): lógica de estado testável separada da casca
  Preact/DOM.

## Arquitetura

Padrão puro×casca. Nova estrutura em `src/app/`:

```
src/app/
  main.ts                 # bootstrap: i18n.init() → render(<App/>, #app); importa tokens/global css
  App.tsx                 # shell: lê o sinal de rota e renderiza a tela corrente
  router/
    routes.ts             # PURO: tipo Screen + HOME_SCREEN; sem sinais, sem DOM
    router.ts             # casca reativa: sinal `route` + navigate()/back() sobre uma pilha
    index.ts              # barrel
  game/
    startGame.ts          # helper imperativo: monta o Phaser num container → retorna stop()
  screens/
    HomeScreen.tsx        # menu temporário (botões p/ cada destino + Jogar); menu real é 4.3
    PlayScreen.tsx        # monta/destroi o jogo no mount/unmount
    PlaceholderScreen.tsx # stub genérico parametrizado por chave de título (telas 4.2–4.8)
  styles/
    tokens.css            # design tokens (custom properties)
    global.css            # reset + base + safe-area
```

### 1. Router (puro + casca reativa)

**`routes.ts` (PURO, testável, sem sinais/DOM):**
- `type Screen = 'home' | 'play' | 'profile' | 'nest' | 'shop' | 'settings' | 'leaderboard' | 'expansions'`.
- `const HOME_SCREEN: Screen = 'home'` (raiz da pilha).
- Opcional: `const ALL_SCREENS: readonly Screen[]` p/ testes de completude.

**`router.ts` (casca reativa com `@preact/signals`, já é dependência):**
- Estado interno: uma **pilha de histórico** `Screen[]`, começando em `[HOME_SCREEN]`.
- `route` — sinal (`signal<Screen>`) com o topo da pilha; é o que o `App` observa.
- `navigate(screen: Screen)` — empilha e atualiza o sinal. Navegar para a rota corrente é no-op
  (não duplica pilha).
- `back()` — desempilha se houver mais de um item; na raiz é no-op (não sai da Home). Atualiza o
  sinal para o novo topo.
- `canGoBack()` — `true` sse a pilha tem mais de um item (para mostrar/ocultar botão Voltar).
- A lógica de pilha (navigate/back/canGoBack sobre um array + topo) é a parte **testável**; o
  sinal é só o espelho reativo. Estrutura para que a Fase 7 possa sincronizar com
  `history`/hash sem reescrever o modelo.

**Decisão: router custom com signals, não `preact-router`/`wouter`.** Motivos: zero dependência
nova (alinha com "sem frameworks pagos" / dep mínima do projeto); o conjunto de telas é pequeno e
fixo; a lógica de pilha fica pura e unit-testável (padrão puro×casca já usado no render). URL/hash
routing não é necessário offline — deep-link para PWA é escopo da Fase 7 e pode ser adicionado como
sincronização por cima deste modelo.

### 2. App shell (`App.tsx`)

- Lê `route.value` (assinatura reativa via signals) e faz `switch` para o componente da tela.
- Mapeamento tela→componente: `home`→`HomeScreen`; `play`→`PlayScreen`; as demais
  (`profile|nest|shop|settings|leaderboard|expansions`)→`PlaceholderScreen` com a chave de título
  correspondente. Itens futuros substituem entradas deste mapeamento pelo componente real.
- `default: never` no switch (exaustividade): adicionar um `Screen` sem tratá-lo quebra o `tsc`.

**`main.ts` passa a:**
```
import './styles/tokens.css';
import './styles/global.css';
await i18n.init();
document.documentElement.lang = i18n.getLanguage();
document.title = i18n.t('app.title');
render(<App/>, document.getElementById('app')!);
```
(a fiação de jogo hoje em `main.ts` migra para `game/startGame.ts` + `PlayScreen`.)

### 3. Integração do jogo como tela (`game/startGame.ts` + `PlayScreen.tsx`)

`createGame` retorna um `Phaser.Game` (tem `.destroy(true)`) e `bindGameControls` já retorna um
cleanup — a integração é uma composição limpa desses dois:

**`startGame(container: HTMLElement): () => void`** (casca imperativa, sem teste unitário, como a
casca Phaser existente): reproduz o que `main.ts` faz hoje — cria `FlapInputSource`,
`PauseController`, `MatchController` (factory com `randomEndlessSeed`), `createGame(container, ...)`
e `bindGameControls(window, ...)`. Retorna um **`stop()`** que faz `game.destroy(true)` +
`cleanupControls()`.

**`PlayScreen.tsx`:** um `<div ref>` container; no mount (`useEffect`/`useLayoutEffect` do
`preact/hooks`) chama `startGame(ref)`; no unmount chama o `stop()` retornado. Sair de Play ⇒ jogo
destruído e listeners removidos; voltar a Play ⇒ partida nova (nascer novo `match`/seed). Um botão
"Voltar" (canto) chama `router.back()`.

**Decisão: destruir o jogo ao sair de Play** (em vez de manter vivo/pausado em background). Mais
simples, sem custo de rAF/render fora da tela, e uma nova partida ao voltar é comportamento
aceitável para 4.1. Keep-alive/resume pode ser adicionado depois se algum fluxo exigir.

### 4. Telas placeholder

- **`HomeScreen.tsx`** — menu **temporário** (o menu real é 4.3): título do jogo + uma lista de
  botões que fazem `navigate(...)` para cada destino (`Jogar`→play, e os stubs), usando rótulos
  i18n `nav.*`. Serve para exercitar a navegação ponta-a-ponta e dar um ponto de entrada visível.
- **`PlaceholderScreen.tsx`** — componente genérico com prop `titleKey: string`: renderiza o
  título (via `i18n.t(titleKey)`), um texto "em breve" (`screen.comingSoon`) e um botão Voltar
  (`nav.back` → `router.back()`). Reusado pelas 6 telas-stub. Itens futuros trocam a entrada do
  mapeamento no `App` pelo componente real da tela.

### 5. Design tokens (`styles/tokens.css` + `global.css`)

**`tokens.css`** — custom properties em `:root`, mobile-first:
- **Cores** neutras (bg, surface, primary, on-primary, text, text-muted, accent, danger). Neutras
  e centralizadas para que packs cosméticos (Fase 8) possam re-temar via override das variáveis.
- **Espaçamento** — escala `--space-1..6` (ex.: 4/8/12/16/24/32px).
- **Tipografia fluida** — `--font-size-*` com `clamp()` (escala com a viewport; funciona em
  celular pequeno até desktop) e uma família de fonte de sistema (sem web-font externa — Fase 8).
- **Raios/superfícies** — `--radius-*`, sombra base.

**`global.css`** — reset leve (box-sizing, margens zeradas, `#app` ocupando `100%`/altura da
viewport), tipografia base, cores de fundo/texto dos tokens, e **safe-area**: padding usando
`env(safe-area-inset-*)` no container raiz (o `viewport-fit=cover` já está no `index.html`).
Layout das telas via flexbox + unidades relativas ⇒ retrato e paisagem sem media queries
dedicadas nesta fase (o canvas do jogo é `Scale.FIT` 320×180, o próprio Phaser ajusta).

Sem framework de CSS nem CSS-in-JS: CSS plano com custom properties + classes simples. Estabelece
a convenção mínima para as telas seguintes.

### 6. i18n (REGRA 4)

Novas chaves no `translation` de todos os 10 locales (`en` é a fonte; paridade garantida por
`tests/i18n/locales.test.ts`):
- `nav.play`, `nav.back`, e rótulos de navegação dos destinos: `nav.profile`, `nav.nest`,
  `nav.shop`, `nav.settings`, `nav.leaderboard`, `nav.expansions`.
- `screen.comingSoon` (texto do stub) e títulos de tela: `screen.profile`, `screen.nest`,
  `screen.shop`, `screen.settings`, `screen.leaderboard`, `screen.expansions`.

(Traduções reais nos 10 idiomas via skill `add-locale`. Home/menu real com mais strings é 4.3.)

## Fluxo de dados

```
main.ts ──render──▶ <App> ──lê──▶ route (signal)
                      │
                      ├─ home  ─▶ <HomeScreen>   ──navigate(x)──▶ router ──▶ atualiza route
                      ├─ play  ─▶ <PlayScreen>   ─mount─▶ startGame(ref) ─▶ Phaser.Game + controls
                      │                          ─unmount▶ stop() ─▶ game.destroy + cleanup
                      └─ outros ▶ <PlaceholderScreen titleKey> ──back()──▶ router ──▶ route
```

O jogo (Phaser + core) roda **exatamente como hoje** dentro do `PlayScreen`; o shell só decide
quando ele existe. `src/core/` intocado.

## Tratamento de erros / bordas

- Navegar para a rota já corrente: no-op (sem empilhar duplicado).
- `back()` na raiz (Home): no-op (não deixa a pilha vazia).
- Desmontar `PlayScreen` sem ter montado o jogo (ex.: erro no `createGame`): `stop()` idempotente/
  defensivo (guardar refs possivelmente nulas).
- Duplo mount do `PlayScreen` (StrictMode-like): não aplicável ao Preact aqui, mas `startGame`
  cria um jogo por chamada e `stop()` destrói o correspondente — sem estado global compartilhado.

## Testes

- **`router.ts`/`routes.ts` (puro) — a fundo:** estado inicial = Home; `navigate` empilha e move o
  topo; navegar para a rota corrente é no-op; `back` desempilha; `back` na raiz é no-op;
  `canGoBack` reflete a profundidade da pilha; sequências navigate/back consistentes.
- **Smoke de render do `<App>`:** adicionar `happy-dom` como devDep e um teste que renderiza o
  `App`, confirma que a Home aparece, dispara `navigate('settings')` e confirma que o placeholder
  de Settings aparece (e Voltar retorna à Home). Sem testar a casca Phaser (`startGame`/`PlayScreen`
  não têm teste unitário, como o resto da casca de render) — verificação visual via Playwright.
- **i18n:** `tests/i18n/locales.test.ts` já garante paridade das novas chaves entre os 10 locales.
- **Verificação visual (Playwright):** Home renderiza com os botões; "Jogar" leva ao jogo (canvas
  visível, dino jogável); Voltar volta à Home destruindo o jogo; um stub abre e volta.

## Definição de pronto

- `npm run check` limpo (tsc estrito + eslint), `npm test` verde (incluindo o novo router test, o
  smoke de App e a paridade i18n).
- Navegação ponta-a-ponta funcional: Home ⇄ Play (jogo montando/destruindo sem leak) e Home ⇄
  stubs.
- Design tokens aplicados; layout respeita safe-area e funciona em retrato e paisagem.
- `src/core/` intocado (determinismo inalterado, 64 testes de determinismo verdes).
- Item 4.1 marcado `[x]` em `docs/roadmap/PHASE-04-meta-offline.md`; "Estado atual" do `CLAUDE.md`
  atualizado.

## Adiados (registro explícito)

- Menu Home real com todas as opções (Novo Jogo/Diário/Semanal/Config/Leaderboard/Ninho/Loja/
  Expansões/Doação/Compartilhar) — 4.3.
- Telas reais (perfil, ninho, loja, expansões, configurações, leaderboard) — 4.2/4.4/4.5/4.6/4.8/
  Fase 5.
- Troca de idioma ao vivo (re-render reativo ao `changeLanguage`) — 4.8 (seam pronta aqui).
- Roteamento por URL/hash, back-button do browser, deep-link PWA — Fase 7.
- Transições animadas entre telas, temas de pack cosméticos aplicados aos tokens — Fase 8.
- Keep-alive/resume do jogo ao navegar (hoje destrói e recria) — se algum fluxo exigir.
