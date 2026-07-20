# UI W1: fundação de layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** O fundo pintado aparece full-bleed, os botões contêm o rótulo sem transbordar, e as telas cabem na viewport widescreen sem scroll — mantendo mobile usável.

**Architecture:** Remove o painel 9-slice de tela inteira de `.screen`/`.home`; adiciona legibilidade (text-shadow + vinheta); reescreve o 9-slice de `.btn` (bordas topo/base finas + rótulo centrado); reduz o footprint vertical do Home. Quase tudo em `global.css` + pequenas edições no `HomeScreen.tsx`.

**Tech Stack:** CSS (design tokens, border-image), Preact.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**.
- Sem dep nova; sem strings i18n novas.
- Preservar invariantes do 7.2: sem scroll **horizontal**; alvos de toque ≥44px; retrato+paisagem.
- Um commit por task; rodapé `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: CSS de fundação + Home footprint

**Files:**
- Modify: `src/app/styles/global.css`
- Modify: `src/app/screens/HomeScreen.tsx`

**Interfaces:** nenhuma API (casca CSS/DOM; validado no Playwright da Task 2).

- [ ] **Step 1: Remover o painel de tela inteira** — em `src/app/styles/global.css`, DELETAR a regra (adicionada na Rodada A):

```css
.screen,
.home {
  border: 22px solid transparent;
  border-image: var(--ui-panel) 12% fill / 22px / 0 stretch;
}
```
(nada substitui — o `body { background-image: var(--bg-screen) }` passa a aparecer.)

- [ ] **Step 2: Legibilidade (text-shadow + vinheta)** — em `global.css`, adicionar ao final:

```css
/* UI W1: texto solto legível sobre o fundo pintado + vinheta de borda. */
.screen__title,
.home__name,
.expansions__note,
.leaderboard__source,
.leaderboard__empty,
.trophies__empty {
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
}
#app::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.45) 100%);
}
#app > * {
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 3: Corrigir os botões 9-slice** — em `global.css`, SUBSTITUIR a regra `.btn { … }` inteira por:

```css
.btn {
  font: inherit;
  font-size: var(--font-size-md);
  color: var(--color-on-primary);
  background: transparent;
  border-style: solid;
  border-color: transparent;
  border-width: 6px 22px;
  border-image: var(--ui-button) 18% 34% fill / 6px 22px / 0 stretch;
  padding: var(--space-2) var(--space-4);
  min-width: 12rem;
  min-height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  cursor: pointer;
}
```
E SUBSTITUIR a regra `.btn--ghost { … }` por:

```css
.btn--ghost {
  color: var(--color-text);
  border-image: var(--ui-button-ghost) 18% 34% fill / 6px 22px / 0 stretch;
}
```
E adicionar (altura extra p/ o rótulo grande do primário):

```css
.home__primary {
  font-size: var(--font-size-lg);
  min-width: min(100%, 20rem);
  min-height: 3.6rem;
}
```
(as regras `.btn:active` / `.btn:disabled` existentes permanecem. Se houver uma `.home__primary` antiga com só `font-size`/`min-width`, substitua-a por esta.)

- [ ] **Step 4: Home footprint (logo + grade)** — em `global.css`:

Substituir `.home__logo { … }` por:
```css
.home__logo {
  display: block;
  align-self: center;
  width: min(48%, 16rem);
  height: auto;
  margin: 0 auto var(--space-2);
}
```
Substituir `.home__grid { … max-width … }` para aproveitar a largura (mantendo o resto):
```css
.home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-3);
  width: min(100%, 44rem);
}
```
(DELETAR a regra `.home__emblem { … }` — o elemento sai no Step 5.)

- [ ] **Step 5: Remover o emblema-divisor do Home** — em `src/app/screens/HomeScreen.tsx`, DELETAR a linha:

```tsx
      <img class="home__emblem" src={`${import.meta.env.BASE_URL}ui/emblem.png`} alt="" aria-hidden="true" />
```
(o `emblem.png` segue disponível p/ uso futuro; só sai do Home.)

- [ ] **Step 6: Tipos + suíte**

Run: `npm run check && npm test`
Expected: verde. Se algum teste asseverar `.home__emblem` (grep `home__emblem` em `tests/`), atualizá-lo minimamente (o emblema saiu do Home por design). Determinismo intocado.

- [ ] **Step 7: Commit**

```bash
git add src/app/styles/global.css src/app/screens/HomeScreen.tsx
git commit -m "feat(ui-w1): fundo full-bleed + botões 9-slice corrigidos + Home responsivo"
```

---

### Task 2 (controlador, inline): validação widescreen + tuning + docs

- [ ] **Step 1:** `npm run build` + `npx vite preview`; Playwright **1366×768** (widescreen). Home: `getComputedStyle(body).backgroundImage` referencia `bg.screen.classic` E o fundo está VISÍVEL (não coberto por painel); "Novo Jogo" com o rótulo DENTRO do botão (sem overflow); `document.documentElement.scrollHeight <= window.innerHeight` (sem scroll vertical). Screenshot.
- [ ] **Step 2:** Sub-telas em 1366×768 (Ninho/Loja/Leaderboard via navegação): fundo visível, botões (Comprar/Adicionar) com rótulo cabendo sem sobrepor. Screenshot 1–2.
- [ ] **Step 3:** **Tuning** — se algum botão ainda cortar/transbordar o rótulo ou a moldura ficar feia, ajustar `border-width`/`border-image` slice/`min-height` em `global.css` (inline, commit de tuning) e revalidar até limpo.
- [ ] **Step 4:** **Mobile 390×844** — sem regressão: sem scroll horizontal, botões e menu legíveis. Screenshot.
- [ ] **Step 5:** Atualizar `docs/roadmap/PHASE-08-art-and-packs.md` (ou uma nota de UI) + `CLAUDE.md` (W1 feita; W2/W3/W4 restantes). Commit.

**Gotcha (7.2/8.3):** SW pode servir dist antigo — `unregister()` + limpar caches + `?nocache=<ts>`.

## Self-Review

- **Cobertura:** remove painel de tela cheia (bg aparece) ✓; legibilidade ✓; botões corrigidos ✓; Home footprint/responsivo ✓; validação widescreen+mobile+tuning ✓; core intocado ✓.
- **Placeholders:** valores de border-image/altura são placeholders explícitos, ajustados na Task 2.
- **Consistência:** `--bg-screen`/`--ui-button`/`--ui-button-ghost`/`--ui-panel` já existem (Tier-1); só muda o CSS que os consome. `home__emblem` removido do DOM e do CSS juntos.
