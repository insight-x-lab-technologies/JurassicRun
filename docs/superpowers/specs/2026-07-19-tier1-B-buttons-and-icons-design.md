# Design — Tier-1 Rodada B: botões 9-slice + ícones de nav (+ otimização de fundos)

**Data:** 2026-07-19
**Item:** 8.1 Tier-1, rodada B de A→B→C→D.
**Escopo:** (1) `gen-ui.mjs` ganha **grid-slice uniforme** (corta sheets em células nomeadas);
(2) **botões** 9-slice (`ui.buttons` → primary/secondary); (3) **ícones de nav** (`ui.icons` →
10 `icon.<rota>`) nos botões do menu; (4) **otimização de peso** dos fundos (reduz o precache).
Rodada C (emblema/statchip/nav-bar/medalhas de `ui.remaining` — rects não-uniformes — + capas +
dinos do Ninho) e D (parallax) vêm depois.

## Contexto e restrições

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**. Toca `scripts/`, `src/app/`, `public/ui/`, `tests/`.
- Reusa o pipeline da Rodada A: `gen-ui.mjs` (`UI_SOURCES`/`renderUi`, decoder/`cropResize`),
  `public/ui/` (runtime, precacheado), painéis/fundos já aplicados.
- REGRA 2 (arte por dados/CSS). REGRA 3 (menus DOM estático, sem trabalho por frame). Sem dep nova.

## Componentes

### 1. `gen-ui.mjs` — grid-slice uniforme

Uma entrada de `UI_SOURCES` passa a aceitar `grid?: { cols, rows, names: string[] }`:
- Sem `grid` → comportamento atual (1 asset por fonte). Com `grid` → divide a imagem em `cols×rows`
  células iguais (row-major), **content-trim** de cada célula (alpha>0), downscale por `maxDim`,
  emite um PNG por `names[i]` (i em row-major). `names.length` deve ser `cols*rows` (guarda no código).
- Reusa `contentBounds`/`cropResize` por célula (sub-retângulo da célula).

Novas fontes (estende `UI_SOURCES`):
```
{ out:'button', file:'ui/ui.buttons.png', maxDim:512,
  grid:{ cols:1, rows:2, names:['button.primary','button.secondary'] } }
{ out:'icon', file:'ui/ui.icons.png', maxDim:96,
  grid:{ cols:5, rows:2, names:[
    'icon.daily','icon.weekly','icon.nest','icon.shop','icon.expansions',
    'icon.leaderboard','icon.settings','icon.share','icon.donate','icon.back'] } }
```
(ordem row-major casa o sheet, confirmada no spec `ui.icons.md`.) O campo `out` vira só rótulo
(o nome do arquivo passa a ser o `name` da célula quando há `grid`). `renderUi()` retorna
`{out,png}[]` achatado (um item por asset final: 2 botões + 10 ícones + os 5 da Rodada A).

Saída commitada: `public/ui/{button.primary,button.secondary,icon.daily,...,icon.back}.png`.
Teste: cada asset gera PNG válido; determinismo; commitados batem.

### 2. Botões 9-slice (`src/app/styles/global.css`)

- `--ui-button` / `--ui-button-ghost`: **não** via theme (constantes) — fixar no CSS com
  `var(--base-url)`? Não há `--base-url`. Padrão da Rodada A: URLs de imagem por custom property
  setada no `theme.ts` com `import.meta.env.BASE_URL`. Então `applyPackTheme` passa a setar também
  `--ui-button: url(<base>ui/button.primary.png)` e `--ui-button-ghost: url(<base>ui/button.secondary.png)`
  (constantes hoje; seam permite por-pack no futuro). Defaults `none` em `tokens.css`.
- `.btn` (primary) recebe `border-image: var(--ui-button) <slice> fill / <w> / 0 stretch` com
  `border` transparente e **fundo transparente** (`background: transparent`) — a moldura pinta o
  botão. `.btn--ghost` usa `--ui-button-ghost`. 9-slice **horizontal** (pontas fixas, miolo estica;
  `ui.button` spec = 36px de 256 nas laterais). Preserva `min-height:44px`, `:active`, `:disabled`.
- Contraste do texto: manter `--color-on-primary` no `.btn` e `--color-text` no ghost (as artes têm
  centro que comporta o texto). Validar legibilidade no Playwright.

### 3. Ícones de nav (`src/app/screens/HomeScreen.tsx` + CSS)

- Mapa `rota → icon.<rota>` (as 7 do `MENU` + `share`/`donate`). Cada botão do menu ganha um
  `<img class="nav-icon" src={base+'ui/icon.<id>.png'} alt="" aria-hidden>` antes do rótulo i18n.
  `New Game` (primary) fica sem ícone (não há glyph dedicado). Botões viram `display:inline-flex;
  gap` com o ícone à esquerda. `.nav-icon { width:1.4em; height:1.4em; flex:none; }`.
- Sem string i18n nova (ícones decorativos; rótulos textuais permanecem).

### 4. Otimização de peso dos fundos

- Reduz `maxDim` dos 3 `bg.screen.*` de **1280 → 900** (área ~½ ⇒ ~3MB no lugar de ~6MB). Regenera
  `public/ui/bg.screen.*.png`. Fundos são cosméticos, `cover` no `body` ⇒ 900px cobre bem telas
  mobile/tablet. (Melhoria mais profunda — filtragem de scanline no `encodePng` — fica backlog: mexe
  em gen-icons/atlas/pwa e re-commita bytes de vários assets.)

## Testes

- `tests/render/gen-ui.test.ts`: cobre os novos assets (botões+ícones presentes; grid produz
  `names.length` arquivos; determinismo; commitados batem).
- `src/app/theme.test.ts`: `applyPackTheme` seta `--ui-button`/`--ui-button-ghost`.
- Determinismo: **67** (core intocado).
- Playwright (build prod): botões com moldura 9-slice (primary vs ghost distintos) + rótulo legível;
  ícone dourado à esquerda de cada item do menu; sem scroll horizontal; precache menor que 8MB.

## Fora de escopo (C/D)

- `ui.remaining` (emblema/statchip/nav-bar/medalhas — rects não-uniformes); capas de expansão;
  arte dos 10 dinos do Ninho; parallax real.

## Riscos / decisões

- **Grid uniforme** só serve a sheets de células iguais (`ui.icons` 5×2, `ui.buttons` 1×2). `ui.remaining`
  (bandas desiguais) fica p/ a Rodada C com rects explícitos.
- **9-slice de botão + texto:** o miolo estica; garantir `padding` horizontal ≥ pontas p/ o texto não
  invadir a ornamentação. Validar no Playwright.
- **Legibilidade do texto** sobre a arte do botão: se a arte clara reduzir contraste, ajustar
  `text-shadow`/cor no CSS (decisão de tuning no Playwright, sem novo asset).
