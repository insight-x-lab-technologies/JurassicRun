# Design — Tier-1 Rodada A: fundos de tela + painéis 9-slice + logo

**Data:** 2026-07-19
**Item:** 8.1 (rodada Tier-1, parte A de A→B→C→D). Primeira rodada da integração da arte AAA de
UI/fundos (Tier 1, DOM/CSS) por cima dos menus existentes.
**Escopo:** (1) pipeline de **slice/processamento** da arte-fonte → assets de runtime em `public/ui/`;
(2) **fundos de tela** por expansão ativa; (3) **painéis 9-slice** dando legibilidade aos menus sobre
o fundo pintado; (4) **logo** na Home. Rodadas B (botões/ícones/emblema/statchip), C (medalhas/capas/
dinos do Ninho) e D (parallax real) vêm depois.

## Contexto e restrições

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**; sem re-pin de goldens. Toca `scripts/`,
  `src/app/` (CSS + theme + Home), `src/render/packs.ts` (dado do pack), `public/ui/`, `tests/`.
- A UI é class-based sobre design tokens (`src/app/styles/{tokens,global}.css`); tema reativo por
  `activeExpansion` já existe (`src/app/theme.ts` `bindPackTheme` → `applyPackTheme` seta custom
  properties em `:root`; `LookPack.theme`). **Estende-se esse mesmo seam.**
- REGRA 2 (arte por dados): trocar look = editar pack/CSS/assets, nunca lógica. REGRA 3: menus são
  DOM estático (fora do loop do jogo) ⇒ sem trabalho por frame.
- **Decisão do usuário:** menus ficam legíveis via **painéis 9-slice** (não scrim escuro).
- Arte-fonte validada e commitada (PR #7) em `public/art/final/`: `ui.panel.frame.png` (1254×1254,
  9-slice), `logo.app.png` (1536×1024, alpha), `backgrounds/bg.screen.{classic,volcano,glacier}.png`
  (1672×941, RGB opaco).

## Separação insumo-de-build × asset-de-runtime (decisão-chave)

`public/art/` é **insumo de build** (excluído do precache do SW por `globIgnores`, PR #6) — arte
grande, não servida ao runtime. O novo `scripts/gen-ui.mjs` **processa** a arte-fonte (trim +
downscale) e emite os assets de runtime **pequenos** em **`public/ui/`** (fora de `art/` ⇒
precacheados, servidos, referenciados por CSS/img). Isto resolve de vez "asset de runtime deve ser
cacheável offline" e mantém o bundle enxuto.

## Componentes

### 1. `scripts/gen-ui.mjs` — processador de assets de UI (framework, seed = Rodada A)

Reusa o **decoder PNG** e `encodePng` (padrão de `gen-atlas.mjs`; zero dep). Config declarativa
`UI_SOURCES` (exportada p/ teste). Cada entrada: `{ out, file, maxDim, opaque? }`:
- Decodifica `public/art/final/<file>`.
- `opaque:true` (backgrounds RGB) → downscale direto (sem trim de alpha). `opaque` ausente →
  trim da bbox de conteúdo (alpha>0) + downscale. Downscale = box-average peso-alpha (mesma função
  de `gen-atlas`).
- Escreve `public/ui/<out>.png`.

Seed da Rodada A (`UI_SOURCES`):
```
{ out:'panel',            file:'ui/ui.panel.frame.png',           maxDim: 512 }
{ out:'logo',             file:'ui/logo.app.png',                 maxDim: 640 }
{ out:'bg.screen.classic',file:'backgrounds/bg.screen.classic.png', maxDim: 1280, opaque:true }
{ out:'bg.screen.volcano',file:'backgrounds/bg.screen.volcano.png', maxDim: 1280, opaque:true }
{ out:'bg.screen.glacier',file:'backgrounds/bg.screen.glacier.png', maxDim: 1280, opaque:true }
```
`npm run gen:ui`. As saídas `public/ui/*.png` são **commitadas** (como o atlas). Rodadas B/C
**estendem** `UI_SOURCES` (grid-slice de sheets entra aqui) — o framework é escrito 1× agora.
Teste: `renderUi()` (ou `processSource`) determinístico; cada `out` produz PNG válido (assinatura +
IHDR); os 5 arquivos commitados batem com o gerado.

### 2. Fundo de tela por expansão (`src/render/packs.ts` + `src/app/theme.ts` + CSS)

- `LookPack` ganha `bgScreen: string` (nome do asset em `public/ui/`, ex.: `'bg.screen.classic'`).
  classic/volcano/glacier apontam cada um p/ o seu (todos existem). `PACK_CLASSIC.bgScreen =
  'bg.screen.classic'` etc.
- `applyPackTheme(pack)` passa a setar também a custom property `--bg-screen: url(<BASE_URL>ui/
  <pack.bgScreen>.png)` em `:root` (junto das cores). Reativo por `activeExpansion` (já é).
  `BASE_URL` respeitado (Pages/itch) — lê `import.meta.env.BASE_URL` no theme.ts (casca, permitido).
- Camada de fundo (CSS): `body` (ou `#app`) recebe `background-image: var(--bg-screen)` com
  `background-size: cover; background-position: center; background-attachment: fixed`. Fallback
  `--color-bg` quando a var não resolve (pré-JS / classic). `tokens.css` define `--bg-screen: none`
  default (evita FOUC quebrado).

### 3. Painéis 9-slice para legibilidade (`src/app/styles/global.css`)

- Nova custom property `--ui-panel: url(<BASE_URL>ui/panel.png)` setada por `applyPackTheme`
  (constante hoje — 1 painel; o seam permite painel por pack no futuro). Alternativa mais simples:
  fixar o url em `global.css` com `var(--base-url,'')`? Não — mantém-se via `theme.ts` p/ respeitar
  `BASE_URL`, coerente com `--bg-screen`.
- `.screen` e `.home` passam a renderizar sobre um **painel 9-slice**:
  `border-image: var(--ui-panel) <slice> fill / <width> / 0 stretch;` + `border-style: solid;`
  `border-width` = a largura visual da moldura. O `fill` pinta o **centro translúcido escuro** da
  moldura como fundo do painel ⇒ texto legível sobre qualquer `bg.screen`. Insets 9-slice derivam do
  spec (`ui.panel.frame`: 48px em 512 ⇒ escala proporcional ao asset processado `panel.png`).
- `.play-screen` **NÃO** recebe painel (é o jogo). Ajuste de `padding`/`min-height` p/ o conteúdo não
  colar na moldura; mantém `overflow-y:auto` interno (o border-image fica fixo, conteúdo rola dentro).
- Mobile-first, retrato+paisagem, sem scroll horizontal preservados (7.2). Alvos de toque ≥44px
  intactos.

### 4. Logo na Home (`src/app/screens/HomeScreen.tsx` + CSS)

- Adiciona `<img class="home__logo" src={logoUrl} alt="" />` no topo do `.home` (a `h1.sr-only`
  com `app.title` permanece p/ leitores de tela ⇒ `alt=""` decorativo). `logoUrl` =
  `import.meta.env.BASE_URL + 'ui/logo.png'`. `.home__logo { max-width: min(80%, 22rem); height:auto;
  align-self:center; }`.
- Sem string i18n nova (logo é imagem; título acessível já existe).

## Testes

- `tests/render/gen-ui.test.ts` (novo): `UI_SOURCES` processa; cada `out` gera PNG válido; determinismo;
  os 5 `public/ui/*.png` commitados batem com o gerado.
- `tests/render/packs.test.ts`: `PACK_CLASSIC.bgScreen==='bg.screen.classic'`; volcano/glacier idem.
- `src/app/theme.test.ts`: `applyPackTheme` seta `--bg-screen` e `--ui-panel` (jsdom/happy-dom;
  molde do teste existente do tema).
- `tests/assets/registry-specs.test.ts`: guarda de que os `out` de `UI_SOURCES` têm o PNG-fonte em
  `public/art/final/`.
- Determinismo: `npm run test:determinism` = **67** (core intocado).
- Validação visual (Playwright, build de produção): Home mostra logo + menu sobre painel 9-slice
  sobre o fundo pintado; trocar expansão (classic→volcano→glacier) troca o fundo AO VIVO; texto
  legível; sem scroll horizontal; retrato+paisagem OK.

## Determinismo e perf

Core intocado ⇒ **det 67**. Menus são DOM estático ⇒ sem trabalho por frame (REGRA 3). Assets de
runtime downscaled (`public/ui/`, precacheados) ⇒ bundle enxuto; arte-fonte segue fora do precache.

## Fora de escopo (rodadas seguintes)

- B: botões 9-slice (2 variantes), ícones de nav (10), statchip frame, header emblem.
- C: medalhas (leaderboard), capas de expansão (cards), arte dos 10 dinos do Ninho.
- D: parallax real in-game (`bg.layers.png` → far/mid/near no `GameScene`).
- Painel/fundo **por pack** além do trio atual; animação de transição de fundo; arte do logo por
  pack.

## Riscos / decisões

- **border-image com `fill` + scroll interno:** o `.screen` rola por dentro; a moldura fica no border
  box (fixa). Validar no Playwright que o conteúdo alto rola sem clipar a moldura (paisagem curta).
- **Peso dos fundos:** 3×~150KB downscaled ⇒ precache sobe ~0,5MB (aceitável; eram cosméticos e
  antes nem cacheados). `maxDim 1280` cobre telas grandes sem exagero.
- **`BASE_URL` nas urls de CSS:** as custom properties de imagem são montadas no `theme.ts` (casca,
  lê `import.meta.env.BASE_URL`) ⇒ corretas sob subdiretório do Pages/itch (não hardcodar `/`).
- **Legibilidade:** o centro translúcido do painel garante contraste do texto sobre qualquer fundo;
  sem depender de scrim (decisão do usuário).
