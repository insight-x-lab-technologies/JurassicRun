# Tier-1 Rodada B: botões 9-slice + ícones de nav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Botões do menu renderizam com moldura 9-slice (primary/secondary) e cada item do menu ganha um ícone dourado; `gen-ui.mjs` ganha grid-slice e os fundos ficam mais leves.

**Architecture:** `gen-ui.mjs` corta sheets uniformes (`ui.buttons` 1×2, `ui.icons` 5×2) em PNGs nomeados em `public/ui/`; `theme.ts` seta `--ui-button`/`--ui-button-ghost`; CSS aplica `border-image` nos botões e ícones nos itens do menu (HomeScreen).

**Tech Stack:** Node ESM, Vitest+happy-dom, TypeScript estrito, CSS border-image, Preact.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**.
- Look só por dados/CSS; sem dep nova; scripts só `node:*` + `encodePng`.
- Runtime assets em `public/ui/` (precacheados); URLs de imagem via `theme.ts` com `import.meta.env.BASE_URL`.
- `renderUi()` síncrona, retorna `{out,png:Buffer}[]` (um item por asset final).
- Um commit por task; rodapé `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `gen-ui.mjs` grid-slice + botões/ícones + fundos mais leves

**Files:**
- Modify: `scripts/gen-ui.mjs` (grid + novas fontes + bg maxDim 900)
- Modify: `scripts/gen-ui.d.mts` (tipo `grid?`)
- Modify: `tests/render/gen-ui.test.ts` (cobre botões/ícones)
- Regenera (via `npm run gen:ui`) e commita `public/ui/`: `button.primary`, `button.secondary`, `icon.daily`, `icon.weekly`, `icon.nest`, `icon.shop`, `icon.expansions`, `icon.leaderboard`, `icon.settings`, `icon.share`, `icon.donate`, `icon.back` (novos) + `bg.screen.{classic,volcano,glacier}` (reduzidos)

**Interfaces:**
- Produces: `UI_SOURCES` com `grid?:{cols,rows,names:string[]}`; `renderUi(): {out,png}[]` achatado (um item por asset final — nome = `name` da célula quando há grid, senão `out`).

- [ ] **Step 1: Reescrever `renderUi` com suporte a grid** — em `scripts/gen-ui.mjs`, substituir o array `UI_SOURCES` e a função `renderUi`/`processSource` por:

```js
export const UI_SOURCES = [
  { out: 'panel', file: 'ui/ui.panel.frame.png', maxDim: 512 },
  { out: 'logo', file: 'ui/logo.app.png', maxDim: 640 },
  { out: 'bg.screen.classic', file: 'backgrounds/bg.screen.classic.png', maxDim: 900, opaque: true },
  { out: 'bg.screen.volcano', file: 'backgrounds/bg.screen.volcano.png', maxDim: 900, opaque: true },
  { out: 'bg.screen.glacier', file: 'backgrounds/bg.screen.glacier.png', maxDim: 900, opaque: true },
  { out: 'button', file: 'ui/ui.buttons.png', maxDim: 512,
    grid: { cols: 1, rows: 2, names: ['button.primary', 'button.secondary'] } },
  { out: 'icon', file: 'ui/ui.icons.png', maxDim: 96,
    grid: { cols: 5, rows: 2, names: [
      'icon.daily', 'icon.weekly', 'icon.nest', 'icon.shop', 'icon.expansions',
      'icon.leaderboard', 'icon.settings', 'icon.share', 'icon.donate', 'icon.back'] } },
];

// Recorta a bbox de conteúdo dentro de [x0,x1)×[y0,y1), downscala por maxDim, devolve {w,h,pixels}.
function crop(img, x0, y0, x1, y1, maxDim, opaque) {
  if (!opaque) { const b = contentBounds(img, x0, y0, x1, y1); x0 = b.minX; y0 = b.minY; x1 = b.maxX; y1 = b.maxY; }
  const sw = x1 - x0, sh = y1 - y0;
  const s = Math.min(1, maxDim / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * s)), dh = Math.max(1, Math.round(sh * s));
  return { w: dw, h: dh, pixels: cropResize(img, x0, y0, sw, sh, dw, dh) };
}

export function renderUi() {
  const outs = [];
  for (const src of UI_SOURCES) {
    const img = decodePng(readFileSync(path.join(ART, src.file)));
    if (src.grid) {
      const { cols, rows, names } = src.grid;
      if (names.length !== cols * rows) throw new Error(`grid ${src.out}: names ${names.length} != ${cols * rows}`);
      const cw = Math.floor(img.w / cols), ch = Math.floor(img.h / rows);
      let i = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const { w, h, pixels } = crop(img, c * cw, r * ch, c * cw + cw, r * ch + ch, src.maxDim, false);
        outs.push({ out: names[i++], png: encodePng(w, h, pixels) });
      }
    } else {
      const { w, h, pixels } = crop(img, 0, 0, img.w, img.h, src.maxDim, src.opaque);
      outs.push({ out: src.out, png: encodePng(w, h, pixels) });
    }
  }
  return outs;
}
```
(Mantém os imports e o `main()` existentes — `main` já itera `renderUi()` escrevendo `public/ui/${out}.png`, então funciona com os nomes de célula sem mudança.)

- [ ] **Step 2: Atualizar `scripts/gen-ui.d.mts`**:

```ts
export const UI_SOURCES: readonly {
  out: string; file: string; maxDim: number; opaque?: boolean;
  grid?: { cols: number; rows: number; names: readonly string[] };
}[];
export function renderUi(): { out: string; png: Buffer }[];
```

- [ ] **Step 3: Estender o teste** — em `tests/render/gen-ui.test.ts`, adicionar dentro do describe:

```ts
  it('grid gera um asset por célula (botões + ícones)', () => {
    const names = renderUi().map((o) => o.out);
    for (const n of ['button.primary', 'button.secondary',
      'icon.daily', 'icon.weekly', 'icon.nest', 'icon.shop', 'icon.expansions',
      'icon.leaderboard', 'icon.settings', 'icon.share', 'icon.donate', 'icon.back']) {
      expect(names, n).toContain(n);
    }
  });
```
(os testes existentes de PNG-válido/determinismo/commitado-bate já cobrem os novos por iterarem `renderUi()`.)

- [ ] **Step 4: Rodar — deve FALHAR** (assets novos ausentes / bg mudou)

Run: `npx vitest run tests/render/gen-ui.test.ts`
Expected: FAIL (arquivos commitados ausentes; `crop` já existe? não — se der erro de referência, é porque o `renderUi` novo referencia `crop` recém-criada: deve compilar).

- [ ] **Step 5: Gerar**

Run: `npm run gen:ui`
Expected: imprime 17 linhas `escrito public/ui/<out>.png` (5 antigos + 2 botões + 10 ícones).

- [ ] **Step 6: Rodar — deve PASSAR + suíte + tipos**

Run: `npx vitest run tests/render/gen-ui.test.ts && npm test && npm run check`
Expected: verde.

- [ ] **Step 7: Commit** — inclui todos os `public/ui/*.png` (novos + os 3 bg regenerados):

```bash
git add scripts/gen-ui.mjs scripts/gen-ui.d.mts tests/render/gen-ui.test.ts public/ui/
git commit -m "feat(8.1): gen-ui grid-slice (botões+ícones) + fundos mais leves (maxDim 900)"
```

---

### Task 2: `theme.ts` seta `--ui-button`/`--ui-button-ghost`

**Files:**
- Modify: `src/app/theme.ts`
- Modify: `src/app/styles/tokens.css` (defaults)
- Modify: `src/app/theme.test.ts`

**Interfaces:**
- Consumes: `applyPackTheme`. Produces: custom properties `--ui-button`/`--ui-button-ghost` em `:root`.

- [ ] **Step 1: Teste que falha** — em `src/app/theme.test.ts`, novo `it`:

```ts
it('applyPackTheme seta --ui-button/--ui-button-ghost', () => {
  applyPackTheme(packForId('classic'));
  const s = document.documentElement.style;
  expect(s.getPropertyValue('--ui-button')).toContain('ui/button.primary.png');
  expect(s.getPropertyValue('--ui-button-ghost')).toContain('ui/button.secondary.png');
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/app/theme.test.ts`
Expected: FAIL (vazio).

- [ ] **Step 3: `src/app/theme.ts`** — no `applyPackTheme`, junto das outras custom properties:

```ts
  root.style.setProperty('--ui-button', `url(${base}ui/button.primary.png)`);
  root.style.setProperty('--ui-button-ghost', `url(${base}ui/button.secondary.png)`);
```
(`base` já é `import.meta.env.BASE_URL` da Rodada A.)

- [ ] **Step 4: `src/app/styles/tokens.css`** — junto de `--bg-screen`/`--ui-panel`:

```css
  --ui-button: none;
  --ui-button-ghost: none;
```

- [ ] **Step 5: Rodar — deve PASSAR + tipos**

Run: `npx vitest run src/app/theme.test.ts && npm run check`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/app/theme.ts src/app/styles/tokens.css src/app/theme.test.ts
git commit -m "feat(8.1): theme seta --ui-button/--ui-button-ghost"
```

---

### Task 3: CSS de botões 9-slice + ícones de nav na Home

**Files:**
- Modify: `src/app/styles/global.css`
- Modify: `src/app/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `--ui-button`/`--ui-button-ghost` (Task 2); `public/ui/{button.*,icon.*}.png` (Task 1).
- Produces: nenhuma API (casca CSS/DOM; validado no Playwright da Task 4).

- [ ] **Step 1: Botões 9-slice** — em `src/app/styles/global.css`, na regra `.btn` (adicionar as 3 linhas de moldura mantendo o resto):

Substituir a regra `.btn { ... }` existente por (mantém tamanho/toque; troca o fundo sólido pela moldura):
```css
.btn {
  font: inherit;
  font-size: var(--font-size-md);
  color: var(--color-on-primary);
  background: transparent;
  border: 14px solid transparent;
  border-image: var(--ui-button) 30% fill / 14px / 0 stretch;
  border-radius: 0;
  padding: var(--space-2) var(--space-5);
  min-width: 12rem;
  min-height: 44px;
  cursor: pointer;
}
```
E a regra `.btn--ghost`:
```css
.btn--ghost {
  color: var(--color-text);
  border-image: var(--ui-button-ghost) 30% fill / 14px / 0 stretch;
}
```
(o `box-shadow` sai — a moldura já dá relevo. `:active`/`:disabled` existentes permanecem.)

- [ ] **Step 2: Ícones de nav** — em `global.css`, adicionar ao final:

```css
.nav-icon {
  width: 1.4em;
  height: 1.4em;
  flex: none;
  vertical-align: middle;
}
.home__grid .btn,
.home__actions .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}
```

- [ ] **Step 3: Ícones no HomeScreen** — em `src/app/screens/HomeScreen.tsx`:

Adicionar o mapa perto do topo (após `MENU`):
```tsx
const NAV_ICON: Record<string, string> = {
  daily: 'icon.daily', weekly: 'icon.weekly', nest: 'icon.nest', shop: 'icon.shop',
  expansions: 'icon.expansions', leaderboard: 'icon.leaderboard', settings: 'icon.settings',
};
function navIcon(id: string): string {
  return `${import.meta.env.BASE_URL}ui/${id}.png`;
}
```
No `.map(MENU)`, dentro do `<button>`, antes do label:
```tsx
              <img class="nav-icon" src={navIcon(NAV_ICON[screen] ?? 'icon.nest')} alt="" aria-hidden="true" />
```
Nos botões de ação, antes do label de Share:
```tsx
            <img class="nav-icon" src={navIcon('icon.share')} alt="" aria-hidden="true" />
```
e antes do label de Donate:
```tsx
            <img class="nav-icon" src={navIcon('icon.donate')} alt="" aria-hidden="true" />
```

- [ ] **Step 4: Tipos + suíte**

Run: `npm run check && npm test`
Expected: verde (sem teste de unidade novo — casca CSS/DOM; smoke de App deve continuar passando).

- [ ] **Step 5: Commit**

```bash
git add src/app/styles/global.css src/app/screens/HomeScreen.tsx
git commit -m "feat(8.1): botões 9-slice + ícones de nav na Home"
```

---

### Task 4 (controlador, inline): validação visual + docs

- [ ] **Step 1:** `npm run build` + `npx vite preview`; Playwright (390×844). Home: botões com moldura 9-slice (primary azul vs ghost dourado/escuro distintos), rótulo legível; ícone dourado à esquerda de cada item do menu (daily/weekly/nest/shop/expansions/leaderboard/settings) + share/donate. Sem scroll horizontal. Screenshot.
- [ ] **Step 2:** Conferir precache do build < 8MB (fundos reduzidos). Registrar.
- [ ] **Step 3:** Atualizar `docs/roadmap/PHASE-08-art-and-packs.md` (Tier-1 rodada B) e `CLAUDE.md`. Commit.

**Gotcha (7.2/8.3):** SW pode servir dist antigo — `unregister()` + limpar caches + `?nocache=<ts>` se o visual não atualizar.

## Self-Review

- **Cobertura:** grid-slice + botões/ícones + fundos leves (T1) ✓; theme --ui-button (T2) ✓; CSS botões + ícones Home (T3) ✓; validação+docs (T4) ✓; core intocado ✓.
- **Placeholders:** nenhum.
- **Consistência de tipos:** `grid?` em `UI_SOURCES` (T1) usado por `renderUi`; nomes de célula `button.primary`/`icon.*` (T1) referenciados por `theme.ts` (T2) e HomeScreen/CSS (T3); `--ui-button`/`--ui-button-ghost` setados em T2, consumidos em T3.
