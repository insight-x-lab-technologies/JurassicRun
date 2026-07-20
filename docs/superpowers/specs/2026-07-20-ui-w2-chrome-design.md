# Design — UI W2: chrome (títulos + cards emoldurados + barra de nav)

**Data:** 2026-07-20
**Contexto:** W1 pôs o fundo full-bleed + botões OK. Falta o **chrome** que dá o acabamento do
conceito (`ref/ref_*.png`): títulos ornamentados dourados, **cards/rows emoldurados** com **portraits
grandes**, e uma **barra de navegação inferior**. Decisão do usuário: widescreen casando o conceito,
autônomo W1→W4. Esta é a **W2**. `src/core/` NÃO é tocado ⇒ **det 67**.

## Escopo (chrome de alto impacto compartilhado)

1. Títulos de tela ornamentados (dourado metálico).
2. Cards emoldurados 9-slice + portraits maiores (Ninho/Expansões/Troféus).
3. Barra de navegação inferior (arte `nav.bar`) nas sub-telas.

**Fora de escopo (W2b/W3/W4):** painel de "dino ativo" à esquerda no Ninho; header com stat-chips no
topo das sub-telas; Game Over/ready/pause DOM (W3); HUD/personagem/transições (W4).

## Componentes

### 1. `gen-ui.mjs` — `nav.bar` + portraits de dino maiores

- Extrair a banda **nav-bar** de `ui.remaining` (a Rodada C pulou): nova região
  `{ name:'nav.bar', x:0.03, y:0.55, w:0.94, h:0.14 }` (banda do meio, entre statchip e medalhas;
  content-trim isola). Saída `public/ui/nav.bar.png` (moldura horizontal 9-slice: borda dourada
  superior + corpo escuro).
- **Portraits de dino mais nítidos:** subir o `maxDim` das 10 fontes de dino de **160 → 256** (os
  cards passam a mostrar o portrait grande). Regenera `public/ui/dino.<id>.png`.
- Commitar as saídas atualizadas.

### 2. Barra de navegação inferior (`src/app/components/NavBar.tsx` + CSS + `App.tsx`)

- Componente `NavBar` (Preact): os 7 destinos do menu (`daily, weekly, nest, shop, expansions,
  leaderboard, settings`), cada um = `<button>` com o ícone (`icon.<rota>`) + rótulo i18n (`nav.<rota>`),
  `onClick=navigate(rota)`; o destino da tela atual fica **destacado** (`aria-current`).
- Emoldurada pela arte `nav.bar` via `border-image` 9-slice horizontal (custom property `--ui-navbar`
  setada pelo `theme.ts`, como os outros; default `none`).
- **Posição:** faixa fixa no rodapé (`position: sticky/fixed bottom`), `z-index` acima do conteúdo,
  respeitando `env(safe-area-inset-bottom)`. Em telas estreitas, rola horizontalmente (`overflow-x:auto`)
  ou reduz rótulos (mostra só ícone < 640px).
- **Fiação:** `App.tsx` renderiza `<NavBar current={route}/>` para as sub-telas de navegação
  (`daily, weekly, nest, shop, expansions, leaderboard, settings, trophies, profile`), **não** em
  `home/play/onboarding`. O conteúdo da tela ganha `padding-bottom` p/ não ficar sob a barra.
- Sem string i18n nova (reusa `nav.*`).

### 3. Títulos ornamentados (`global.css`)

`.screen__title` passa a dourado metálico: `background: linear-gradient(#f2d878, #c9a227 55%, #a07d1e)`
+ `-webkit-background-clip:text; color:transparent` (fallback `color: var(--color-gold)`), `font-weight:800`,
`letter-spacing`, `text-shadow` de relevo. (O emblema-flourish acima do título fica p/ W2b — aqui só a
tipografia dourada.)

### 4. Cards emoldurados + portraits (`global.css` + screens)

- `.dino-card`, `.expansion-card`, `.trophy-card` trocam `background: var(--color-surface)` por moldura
  **9-slice** `var(--ui-panel)` (o painel translúcido escuro) — mesmo asset do painel, agora usado no
  seu propósito real (cards/diálogos, não a tela toda). Padding ajustado p/ a moldura.
- **Portrait grande:** `.dino-card__avatar`/`.expansion-card__avatar` deixam de ser círculo pequeno e
  passam a ocupar o topo do card (`width:100%`, altura fixa ~`8rem`, `object-fit:cover`, cantos
  arredondados no topo). O nome/traço/preço ficam abaixo, como no conceito.
- Grid dos cards com `minmax` maior p/ caber o portrait (`minmax(11rem, 1fr)`).

## Testes

- `tests/render/gen-ui.test.ts`: `nav.bar` presente; dinos regenerados (commitados batem).
- `src/app/theme.test.ts`: `--ui-navbar` setado.
- Componente `NavBar`: teste leve (happy-dom) — renderiza os 7 destinos, `navigate` no click, destaca o
  atual (molde dos testes de componente existentes).
- Determinismo: **67**.
- Playwright (build prod, **1366×768**): sub-telas (Ninho/Expansões/Loja) com **barra de nav inferior**
  emoldurada + ícones; **títulos dourados**; **cards emoldurados com portrait grande** (dino/expansão);
  sem scroll horizontal; **390×844** sem regressão (nav rola/compacta).

## Riscos

- **Barra de nav em telas estreitas:** 7 itens podem não caber em 390px → mostrar só ícones (ou rolar).
  Validar/tunar no Playwright.
- **Moldura de card + conteúdo:** o `fill` do 9-slice dá o fundo translúcido; garantir contraste do
  texto (herda text-shadow do W1). Tunar padding/insets.
- **Portrait de dino a 256px:** o frame-0 do strip pode ter margem transparente — o content-trim já
  aperta; `object-fit:cover` preenche o quadro.
