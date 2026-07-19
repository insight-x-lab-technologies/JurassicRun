# Tier-1 Rodada C: medalhas + capas + dinos (+ statchip/emblema) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Leaderboard usa medalhas de arte no top-3, Expansões mostram capas, Ninho mostra a arte dos dinos, chips da Home ganham moldura e a Home ganha um emblema — via slice por regiões no `gen-ui.mjs`.

**Architecture:** `gen-ui.mjs` ganha `regions` (rects fracionários + trim/opaque) e extrai de `ui.remaining`/`expansion.covers`/os strips de dino → `public/ui/`. `theme.ts` seta `--ui-statchip`; CSS/JSX trocam divs-hue/emoji por `<img>`.

**Tech Stack:** Node ESM, Vitest+happy-dom, TypeScript estrito, CSS border-image/object-fit, Preact.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**.
- Look só por dados/CSS; sem dep nova; scripts só `node:*` + `encodePng`.
- Runtime assets em `public/ui/`; URLs via `theme.ts`/JSX com `import.meta.env.BASE_URL`.
- `renderUi()` síncrona, `{out,png}[]` (um item por asset final).
- Um commit por task; rodapé `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `gen-ui.mjs` slice por regiões + fontes da Rodada C

**Files:**
- Modify: `scripts/gen-ui.mjs` (branch `regions` + novas fontes)
- Modify: `scripts/gen-ui.d.mts`
- Modify: `tests/render/gen-ui.test.ts`
- Regenera+commita `public/ui/`: `emblem,statchip,medal.gold,medal.silver,medal.bronze,cover.classic,cover.volcano,cover.glacier,dino.{starter,lodestone,goldbeak,midas,nine-lives,aegis,prospector,harvester,phoenix,guardian}`

**Interfaces:**
- Produces: `UI_SOURCES` com `regions?:{name,x,y,w,h,opaque?}[]` (x/y/w/h frações [0,1]); `renderUi()` inalterado no contrato.

- [ ] **Step 1: Branch `regions` em `renderUi`** — em `scripts/gen-ui.mjs`, dentro do `for (const src of UI_SOURCES)`, ANTES do `else` final (single), adicionar um ramo. A cadeia fica `if (src.grid) {...} else if (src.regions) {...} else {...single...}`:

```js
    } else if (src.regions) {
      for (const rg of src.regions) {
        const x0 = Math.round(rg.x * img.w), y0 = Math.round(rg.y * img.h);
        const x1 = Math.round((rg.x + rg.w) * img.w), y1 = Math.round((rg.y + rg.h) * img.h);
        const { w, h, pixels } = crop(img, x0, y0, x1, y1, src.maxDim, rg.opaque);
        outs.push({ out: rg.name, png: encodePng(w, h, pixels) });
      }
```

- [ ] **Step 2: Novas fontes** — adicionar ao array `UI_SOURCES` (após as fontes existentes):

```js
  { out: 'remaining', file: 'ui/ui.remaining.png', maxDim: 512, regions: [
    { name: 'emblem', x: 0.0, y: 0.05, w: 1.0, h: 0.28 },
    { name: 'statchip', x: 0.12, y: 0.35, w: 0.76, h: 0.16 },
    { name: 'medal.gold', x: 0.03, y: 0.71, w: 0.31, h: 0.27 },
    { name: 'medal.silver', x: 0.34, y: 0.71, w: 0.31, h: 0.27 },
    { name: 'medal.bronze', x: 0.65, y: 0.71, w: 0.31, h: 0.27 } ] },
  { out: 'covers', file: 'expansions/expansion.covers.png', maxDim: 512, regions: [
    { name: 'cover.classic', x: 0.0, y: 0, w: 0.3333, h: 1, opaque: true },
    { name: 'cover.volcano', x: 0.3333, y: 0, w: 0.3333, h: 1, opaque: true },
    { name: 'cover.glacier', x: 0.6667, y: 0, w: 0.3333, h: 1, opaque: true } ] },
  ...['starter', 'lodestone', 'goldbeak', 'midas', 'nine-lives', 'aegis', 'prospector', 'harvester', 'phoenix', 'guardian'].map((id) => ({
    out: `dino.${id}`, file: `dinos/dino.${id}.flap.png`, maxDim: 160,
    regions: [{ name: `dino.${id}`, x: 0, y: 0, w: 0.1667, h: 1 }],
  })),
```

- [ ] **Step 3: Atualizar `scripts/gen-ui.d.mts`** — estender o tipo do elemento de `UI_SOURCES`:

```ts
export const UI_SOURCES: readonly {
  out: string; file: string; maxDim: number; opaque?: boolean;
  grid?: { cols: number; rows: number; names: readonly string[] };
  regions?: readonly { name: string; x: number; y: number; w: number; h: number; opaque?: boolean }[];
}[];
export function renderUi(): { out: string; png: Buffer }[];
```

- [ ] **Step 4: Estender o teste** — em `tests/render/gen-ui.test.ts`, novo `it`:

```ts
  it('regiões geram os assets de medalhas/capas/dinos', () => {
    const names = renderUi().map((o) => o.out);
    for (const n of ['emblem', 'statchip', 'medal.gold', 'medal.silver', 'medal.bronze',
      'cover.classic', 'cover.volcano', 'cover.glacier',
      'dino.starter', 'dino.guardian']) {
      expect(names, n).toContain(n);
    }
  });
```

- [ ] **Step 5: Rodar — deve FALHAR** (assets ausentes)

Run: `npx vitest run tests/render/gen-ui.test.ts`
Expected: FAIL (commitados ausentes).

- [ ] **Step 6: Gerar + PASSAR + suíte**

Run: `npm run gen:ui && npx vitest run tests/render/gen-ui.test.ts && npm test && npm run check`
Expected: `gen:ui` imprime as linhas novas; testes verdes.

- [ ] **Step 7: Commit**

```bash
git add scripts/gen-ui.mjs scripts/gen-ui.d.mts tests/render/gen-ui.test.ts public/ui/
git commit -m "feat(8.1): gen-ui slice por regiões (medalhas/capas/dinos/emblema/statchip)"
```

---

### Task 2: `theme.ts` `--ui-statchip` + CSS (moldura, medalhas, imgs, emblema)

**Files:**
- Modify: `src/app/theme.ts`
- Modify: `src/app/styles/tokens.css`
- Modify: `src/app/styles/global.css`
- Modify: `src/app/theme.test.ts`

**Interfaces:**
- Consumes: `applyPackTheme`. Produces: `--ui-statchip` em `:root`; classes CSS `.medal`, `.home__emblem`, moldura em `.stat-chip`, `<img>` em `.dino-card__avatar`/`.expansion-card__avatar`.

- [ ] **Step 1: Teste que falha** — em `src/app/theme.test.ts`, novo `it`:

```ts
it('applyPackTheme seta --ui-statchip', () => {
  applyPackTheme(packForId('classic'));
  expect(document.documentElement.style.getPropertyValue('--ui-statchip')).toContain('ui/statchip.png');
});
```

- [ ] **Step 2: FALHAR**

Run: `npx vitest run src/app/theme.test.ts`
Expected: FAIL.

- [ ] **Step 3: `src/app/theme.ts`** — no `applyPackTheme`, junto das outras:

```ts
  root.style.setProperty('--ui-statchip', `url(${base}ui/statchip.png)`);
```

- [ ] **Step 4: `src/app/styles/tokens.css`** — junto dos outros defaults:

```css
  --ui-statchip: none;
```

- [ ] **Step 5: `src/app/styles/global.css`** — adicionar ao final:

```css
/* Tier-1 C: moldura do stat-chip, medalhas, arte de card, emblema. */
.stat-chip {
  background: transparent;
  border: 10px solid transparent;
  border-image: var(--ui-statchip) 34% fill / 10px / 0 stretch;
}
.medal {
  width: 1.6em;
  height: 1.6em;
  vertical-align: middle;
}
.home__emblem {
  display: block;
  width: min(70%, 18rem);
  height: auto;
  margin: 0 auto;
}
/* dino/expansão: o avatar vira <img> — object-fit cobre o quadro. */
img.dino-card__avatar,
img.expansion-card__avatar {
  object-fit: cover;
}
img.expansion-card__avatar {
  width: 4rem;
  height: 5rem;
  border-radius: var(--radius-sm);
}
```
(as regras existentes `.stat-chip { ... padding ... }`, `.dino-card__avatar`, `.expansion-card__avatar` permanecem; estas só acrescentam/sobrepõem.)

- [ ] **Step 6: PASSAR + tipos**

Run: `npx vitest run src/app/theme.test.ts && npm run check`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/app/theme.ts src/app/styles/tokens.css src/app/styles/global.css src/app/theme.test.ts
git commit -m "feat(8.1): theme --ui-statchip + CSS de moldura/medalha/emblema/card-img"
```

---

### Task 3: Wiring JSX (Leaderboard, Expansões, Ninho, Home)

**Files:**
- Modify: `src/app/screens/LeaderboardScreen.tsx`
- Modify: `src/app/screens/ExpansionsScreen.tsx`
- Modify: `src/app/screens/NestScreen.tsx`
- Modify: `src/app/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `public/ui/{medal.*,cover.*,dino.*,emblem}.png` (Task 1); CSS classes (Task 2).
- Produces: nenhuma API (casca DOM; validado no Playwright da Task 4).

- [ ] **Step 1: Medalhas no Leaderboard** — em `src/app/screens/LeaderboardScreen.tsx`, substituir as linhas 11-12 (`MEDALS`/`rankGlyph`) por:

```tsx
const MEDAL_IMG: Record<number, string> = { 0: 'medal.gold', 1: 'medal.silver', 2: 'medal.bronze' };
function rankBadge(index: number): VNode | number {
  const m = MEDAL_IMG[index];
  return m
    ? <img class="medal" src={`${import.meta.env.BASE_URL}ui/${m}.png`} alt="" aria-hidden="true" />
    : index + 1;
}
```
E nos dois `<span class="leaderboard__rank" ...>{rankGlyph(index)}</span>` (LocalRow e CentralRow), trocar `{rankGlyph(index)}` por `{rankBadge(index)}`.

- [ ] **Step 2: Capas em Expansões** — em `src/app/screens/ExpansionsScreen.tsx`, substituir o `<div class="expansion-card__avatar" ... />` (linhas ~26-30) por:

```tsx
      <img
        class="expansion-card__avatar"
        src={`${import.meta.env.BASE_URL}ui/cover.${exp.id}.png`}
        alt=""
        aria-hidden="true"
      />
```

- [ ] **Step 3: Arte dos dinos no Ninho** — em `src/app/screens/NestScreen.tsx`, substituir o `<div class="dino-card__avatar" ... />` (linhas ~20-24) por:

```tsx
      <img
        class="dino-card__avatar"
        src={`${import.meta.env.BASE_URL}ui/dino.${dino.id}.png`}
        alt=""
        aria-hidden="true"
      />
```

- [ ] **Step 4: Emblema na Home** — em `src/app/screens/HomeScreen.tsx`, entre o `</header>` da top-bar e o `<main class="home__menu">`, adicionar:

```tsx
      <img class="home__emblem" src={`${import.meta.env.BASE_URL}ui/emblem.png`} alt="" aria-hidden="true" />
```

- [ ] **Step 5: Tipos + suíte**

Run: `npm run check && npm test`
Expected: verde. (Testes de componente que checam `.dino-card__avatar`/`.expansion-card__avatar` por classe seguem passando — a classe é preservada, só muda a tag div→img; se algum teste asseverar `tagName==='DIV'`, reportar.)

- [ ] **Step 6: Commit**

```bash
git add src/app/screens/LeaderboardScreen.tsx src/app/screens/ExpansionsScreen.tsx src/app/screens/NestScreen.tsx src/app/screens/HomeScreen.tsx
git commit -m "feat(8.1): medalhas/capas/arte de dino/emblema nas telas"
```

---

### Task 4 (controlador, inline): validação visual + docs

- [ ] **Step 1:** `npm run build` + `npx vite preview`; Playwright (390×844). Home: emblema + chips com moldura. Ninho: cards com arte dos dinos. Expansões: cards com capas. Leaderboard (semear localStorage `jurassicrun.leaderboard.v1` com ≥3 entradas): medalhas de arte no top-3. Sem scroll horizontal. Screenshots.
- [ ] **Step 2:** Conferir cada asset recortado (emblema/statchip/medalhas sem vizinho straddled; capas sem costura visível). Precache registrado.
- [ ] **Step 3:** Atualizar `docs/roadmap/PHASE-08-art-and-packs.md` (rodada C) + `CLAUDE.md`. Commit.

**Gotcha (7.2/8.3):** SW pode servir dist antigo — `unregister()` + limpar caches + `?nocache=<ts>`.

## Self-Review

- **Cobertura:** regiões + medalhas/capas/dinos/emblema/statchip (T1) ✓; theme+CSS (T2) ✓; wiring 4 telas (T3) ✓; validação+docs (T4) ✓; core intocado ✓.
- **Placeholders:** nenhum.
- **Consistência:** `regions` em `UI_SOURCES` (T1) usado por `renderUi`; nomes `medal.*`/`cover.*`/`dino.*`/`emblem`/`statchip` (T1) referenciados por CSS/JSX (T2/T3) e `--ui-statchip` (T2); ids de dino casam `DINO_ROSTER` (starter…guardian) e de expansão o catálogo (classic/volcano/glacier).
