# Design — UI W1: fundação de layout (fundo full-bleed + botões + responsivo)

**Data:** 2026-07-20
**Contexto:** as refs conceituais (`ref/ref_*.png`, widescreen 1672×941) mostram fundo pintado
full-bleed com widgets emoldurados flutuando; a UI atual (`ref/print_*.png`, 1366×768) aplica um
**painel 9-slice cobrindo a tela inteira** que tapa o fundo, tem **botões quebrados** (rótulo
transbordando/sobrepondo) e **scroll** em widescreen. Decisão do usuário: **widescreen casando o
conceito + adapta mobile**, execução **autônoma W1→W4**. Esta é a **W1 (fundação)** — corrige os 3
bugs reportados + torna responsivo; a composição bespoke por tela (nav inferior, títulos
ornamentados, cards emoldurados, painel de dino ativo, Game Over DOM) é W2–W4.

`src/core/` NÃO é tocado ⇒ **determinismo 67**.

## Problemas que a W1 resolve

1. **Fundo não aparece:** `.screen`/`.home` recebem `border-image: var(--ui-panel) … fill` de 22px
   cobrindo a viewport ⇒ o centro escuro do painel tapa `body { background-image: var(--bg-screen) }`.
2. **Botões quebrados:** `.btn` tem `border: 14px solid transparent` (14px topo+base) ⇒ a caixa de
   conteúdo fica com ~16px de altura e o rótulo grande (`font-size-lg`) transborda ("Novo Jogo");
   botões `.btn` também aparecem superdimensionados e sobrepondo o rótulo vizinho (Loja "Adicionar").
3. **Scroll em widescreen:** layout empilha vertical (logo grande + emblema-divisor + primário +
   grade + …) e estoura 768px de altura.

## Componentes

### 1. Remover o painel de tela inteira (`global.css`)

- **Deletar** a regra `.screen, .home { border: 22px solid transparent; border-image: var(--ui-panel)
  12% fill / 22px / 0 stretch; }` (Rodada A). Sem ela, `body` mostra o `bg.screen` full-bleed.
- `--ui-panel` permanece setado pelo `theme.ts` (será reusado por cards/diálogos em W2/W3).

### 2. Legibilidade sem o painel (`global.css`)

Os widgets já carregam contraste próprio: cards (`background: var(--color-surface)`), chips (moldura
statchip), botões (moldura). Para o texto solto (títulos, notas) sobre o fundo pintado:
- `text-shadow: 0 2px 6px rgba(0,0,0,0.85)` em `.screen__title`, `.home__name`, notas
  (`.expansions__note`, `.leaderboard__source`, textos de ajuda) — legível sobre qualquer bg.
- **Vinheta sutil** de borda: `#app::after` fixo `pointer-events:none` com
  `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)` ⇒ escurece as bordas
  (como os bg do conceito) sem tapar o centro. Fica **abaixo** do conteúdo (z-index) e acima do bg.

### 3. Corrigir os botões 9-slice (`global.css`)

`.btn` passa a moldura **horizontal** (pontas ornamentadas L/R, topo/base finos) e rótulo centrado:
```css
.btn {
  font: inherit; font-size: var(--font-size-md);
  color: var(--color-on-primary);
  background: transparent;
  border-style: solid; border-color: transparent;
  border-width: 6px 22px;                     /* topo/base finos ⇒ não esmaga o rótulo */
  border-image: var(--ui-button) 18% 34% fill / 6px 22px / 0 stretch;
  padding: var(--space-2) var(--space-4);
  min-height: 3rem;                           /* cabe o rótulo com folga */
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  cursor: pointer;
}
.btn--ghost { color: var(--color-text); border-image: var(--ui-button-ghost) 18% 34% fill / 6px 22px / 0 stretch; }
.home__primary { font-size: var(--font-size-lg); min-height: 3.6rem; }
```
(valores de slice/altura são placeholders ajustados na validação; o essencial: topo/base finos +
`inline-flex` centrado + `min-height` que contém o rótulo. `:active`/`:disabled` preservados.)

### 4. Responsivo widescreen sem scroll (`global.css` + `HomeScreen.tsx`)

- `.screen`/`.home` continuam `flex column` centrados, mas **cabem** na viewport: `justify-content:
  safe center`, `overflow-y: auto` só como fallback. Reduzir o footprint vertical do Home:
  - Logo menor: `.home__logo { width: min(48%, 16rem); }` (era 80%/22rem).
  - **Remover** o `<img class="home__emblem">` do Home (duplica o emblema embutido no logo e come
    altura vertical — o conceito não tem divisor separado). Deletar o elemento no `HomeScreen.tsx` e
    a regra `.home__emblem` (o asset `emblem.png` segue usado em outros contextos futuros).
  - Gaps do `.home`/`.home__menu` menores em telas altas o suficiente.
- Grades (`.home__grid`, `.nest__grid`, etc.) já usam `repeat(auto-fit, minmax(...))` ⇒ em widescreen
  espalham horizontalmente sozinhas; só garantir `max-width` maior p/ aproveitar a largura
  (`.home__grid { max-width: 44rem }`).
- **Mobile-retrato** (`@media (max-width: 640px)` ou orientação): mantém empilhamento usável (logo e
  gaps atuais), sem regressão do 7.2 (sem scroll horizontal, alvos ≥44px).

## Testes

- Sem teste de unidade novo (mudança CSS/DOM). Suíte existente segue verde (o smoke de App e testes
  de componente não dependem do painel/emblema — se algum asseverar `.home__emblem`, atualizar).
- Determinismo: **67** (core intocado).
- Validação (controlador, Playwright, **build prod**): **widescreen 1366×768** — Home mostra o
  **fundo pintado** (não o painel), "Novo Jogo" com rótulo **dentro** do botão, **sem scroll**
  vertical; sub-telas (Ninho/Loja/Leaderboard) mostram o fundo + botões cabendo. **Mobile 390×844**
  — sem regressão (sem scroll horizontal, legível). Amostrar `getComputedStyle(body).backgroundImage`
  ≠ none e `document.documentElement.scrollHeight <= innerHeight` no Home widescreen.

## Fora de escopo (W2–W4)

- Barra de navegação inferior; títulos ornamentados; stat-chips no topo das sub-telas; "Voltar"
  emoldurado; cards/rows emoldurados 9-slice; painel de dino ativo no Ninho; portraits grandes;
  Game Over/ready/pause como overlay DOM; HUD in-game; personagem pterodáctilo; transições.

## Riscos

- **Legibilidade de texto solto** sobre bg claro: mitigada por text-shadow + vinheta; se alguma tela
  tiver muito texto solto (ex.: nota honor da Loja), pode ficar bare até a W2 emoldurar — aceitável
  (melhoria progressiva).
- **Tuning dos botões:** os valores de `border-image`/altura serão ajustados no Playwright até o
  rótulo caber limpo em todos (primary/ghost, curtos e longos).
