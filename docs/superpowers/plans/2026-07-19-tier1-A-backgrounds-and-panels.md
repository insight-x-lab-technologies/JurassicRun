# Tier-1 Rodada A: fundos + painéis 9-slice + logo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Menus renderizam sobre **fundos de tela pintados por expansão** + **painéis 9-slice** (legibilidade) e a Home ganha o **logo**, com um processador de assets de UI (`gen-ui.mjs`) que emite runtime PNGs pequenos em `public/ui/`.

**Architecture:** `scripts/gen-ui.mjs` reusa o decoder/`cropResize` de `gen-atlas.mjs` (exportados) para trim+downscale da arte-fonte → `public/ui/*.png`. `LookPack.bgScreen` + `theme.ts` setam `--bg-screen`/`--ui-panel` por expansão ativa; CSS aplica fundo em `body` e painel 9-slice em `.screen`/`.home`; a Home ganha `<img>` do logo.

**Tech Stack:** Node ESM (scripts), Vitest + happy-dom, TypeScript estrito, CSS (design tokens + border-image), Preact.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo **67**; sem re-pin de goldens.
- Look só por dados/CSS (pack/tokens/assets), nunca lógica. (REGRA 2)
- Menus são DOM estático ⇒ sem trabalho por frame. (REGRA 3)
- Sem dep nova. Scripts só `node:*` + `encodePng`.
- Assets de runtime vivem em `public/ui/` (precacheáveis); a arte-fonte em `public/art/` é insumo de build (fora do precache).
- URLs de imagem em CSS custom properties são montadas no `theme.ts` com `import.meta.env.BASE_URL` (corretas sob subdiretório Pages/itch — não hardcodar `/`).
- `renderUi()`/`renderAtlas()` são síncronas e retornam Buffers.
- Um commit por task; mensagem termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `gen-ui.mjs` — processador de assets de UI (+ exportar helpers de PNG)

**Files:**
- Modify: `scripts/gen-atlas.mjs` (adicionar `export` a `decodePng`, `contentBounds`, `cropResize`)
- Modify: `scripts/gen-atlas.d.mts` (declarar os 3 helpers exportados)
- Create: `scripts/gen-ui.mjs`
- Create: `scripts/gen-ui.d.mts`
- Modify: `package.json` (script `gen:ui`)
- Create: `tests/render/gen-ui.test.ts`
- Gera (via `npm run gen:ui`) e commita: `public/ui/{panel,logo,bg.screen.classic,bg.screen.volcano,bg.screen.glacier}.png`

**Interfaces:**
- Consumes: `encodePng` (gen-icons), `decodePng`/`contentBounds`/`cropResize` (gen-atlas, agora exportados).
- Produces: `UI_SOURCES: readonly {out,file,maxDim,opaque?}[]`; `renderUi(): {out:string, png:Buffer}[]`.

- [ ] **Step 1: Exportar os helpers em `scripts/gen-atlas.mjs`** — adicionar a palavra `export` (nada mais) às três declarações existentes:

```js
export function decodePng(buf) {
```
```js
export function contentBounds(img, x0, y0, x1, y1) {
```
```js
export function cropResize(img, sx, sy, sw, sh, dw, dh) {
```
(comportamento de `renderAtlas` inalterado — só adiciona exports.)

- [ ] **Step 2: Declarar os helpers em `scripts/gen-atlas.d.mts`** — adicionar ao final:

```ts
export interface DecodedPng { w: number; h: number; rgba: Buffer; }
export function decodePng(buf: Buffer): DecodedPng;
export function contentBounds(img: DecodedPng, x0: number, y0: number, x1: number, y1: number): { minX: number; minY: number; maxX: number; maxY: number };
export function cropResize(img: DecodedPng, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number): Buffer;
```

- [ ] **Step 3: Escrever o teste** — `tests/render/gen-ui.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { UI_SOURCES, renderUi } from '../../scripts/gen-ui.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('processador de assets de UI (gen-ui)', () => {
  it('renderUi produz um PNG válido por fonte', () => {
    const outs = renderUi();
    expect(outs.length).toBe(UI_SOURCES.length);
    for (const { out, png } of outs) {
      expect(png.subarray(0, 8).toString('hex'), out).toBe('89504e470d0a1a0a');
      expect(png.subarray(12, 16).toString('ascii'), out).toBe('IHDR');
    }
  });

  it('é determinístico', () => {
    const a = renderUi(), b = renderUi();
    for (let i = 0; i < a.length; i++) expect(a[i].png.equals(b[i].png)).toBe(true);
  });

  it('os arquivos commitados em public/ui batem com o gerado', () => {
    for (const { out, png } of renderUi()) {
      const committed = readFileSync(path.join(root, 'public/ui', `${out}.png`));
      expect(committed.equals(png), out).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Escrever `scripts/gen-ui.mjs`**:

```js
// scripts/gen-ui.mjs
// Processa a arte-fonte Tier-1 (public/art/final) em assets de runtime pequenos (public/ui).
// Reusa o decoder/cropResize de gen-atlas + encodePng. Zero dep. Rode `npm run gen:ui`.
import { encodePng } from './gen-icons.mjs';
import { decodePng, contentBounds, cropResize } from './gen-atlas.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ART = path.join(ROOT, 'public/art/final');

// Rodada A. Rodadas B/C estendem esta lista (grid-slice de sheets entra aqui).
export const UI_SOURCES = [
  { out: 'panel', file: 'ui/ui.panel.frame.png', maxDim: 512 },
  { out: 'logo', file: 'ui/logo.app.png', maxDim: 640 },
  { out: 'bg.screen.classic', file: 'backgrounds/bg.screen.classic.png', maxDim: 1280, opaque: true },
  { out: 'bg.screen.volcano', file: 'backgrounds/bg.screen.volcano.png', maxDim: 1280, opaque: true },
  { out: 'bg.screen.glacier', file: 'backgrounds/bg.screen.glacier.png', maxDim: 1280, opaque: true },
];

function processSource(src) {
  const img = decodePng(readFileSync(path.join(ART, src.file)));
  let x0 = 0, y0 = 0, x1 = img.w, y1 = img.h;
  if (!src.opaque) { const b = contentBounds(img, 0, 0, img.w, img.h); x0 = b.minX; y0 = b.minY; x1 = b.maxX; y1 = b.maxY; }
  const sw = x1 - x0, sh = y1 - y0;
  const s = Math.min(1, src.maxDim / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * s)), dh = Math.max(1, Math.round(sh * s));
  return { w: dw, h: dh, pixels: cropResize(img, x0, y0, sw, sh, dw, dh) };
}

export function renderUi() {
  return UI_SOURCES.map((src) => {
    const { w, h, pixels } = processSource(src);
    return { out: src.out, png: encodePng(w, h, pixels) };
  });
}

function main() {
  const dir = path.join(ROOT, 'public/ui');
  mkdirSync(dir, { recursive: true });
  for (const { out, png } of renderUi()) {
    writeFileSync(path.join(dir, `${out}.png`), png);
    console.log(`escrito public/ui/${out}.png (${png.length} bytes)`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 5: Escrever `scripts/gen-ui.d.mts`**:

```ts
export const UI_SOURCES: readonly { out: string; file: string; maxDim: number; opaque?: boolean }[];
export function renderUi(): { out: string; png: Buffer }[];
```

- [ ] **Step 6: Adicionar o script npm** — em `package.json`, no bloco `scripts`, após `"gen:atlas"`:

```json
    "gen:ui": "node scripts/gen-ui.mjs",
```

- [ ] **Step 7: Rodar o teste — deve FALHAR** (sem `public/ui/*` ainda)

Run: `npx vitest run tests/render/gen-ui.test.ts`
Expected: FAIL (arquivo commitado ausente / import ok mas readFileSync lança).

- [ ] **Step 8: Gerar os assets**

Run: `npm run gen:ui`
Expected: imprime 5 linhas `escrito public/ui/<out>.png`.

- [ ] **Step 9: Rodar o teste — deve PASSAR**

Run: `npx vitest run tests/render/gen-ui.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 10: Verificar suíte + tipos**

Run: `npm test && npm run check`
Expected: tudo verde (incl. `tests/render/atlas.test.ts` — só adicionamos exports, `renderAtlas` intacto).

- [ ] **Step 11: Commit**

```bash
git add scripts/gen-atlas.mjs scripts/gen-atlas.d.mts scripts/gen-ui.mjs scripts/gen-ui.d.mts package.json tests/render/gen-ui.test.ts public/ui/panel.png public/ui/logo.png public/ui/bg.screen.classic.png public/ui/bg.screen.volcano.png public/ui/bg.screen.glacier.png
git commit -m "feat(8.1): gen-ui processa arte Tier-1 → public/ui (painel/logo/fundos)"
```

---

### Task 2: `LookPack.bgScreen` + `theme.ts` seta `--bg-screen`/`--ui-panel`

**Files:**
- Modify: `src/render/packs.ts` (campo `bgScreen` na interface + nos 3 packs)
- Modify: `src/app/theme.ts` (`applyPackTheme` seta `--bg-screen` e `--ui-panel`)
- Modify: `src/app/styles/tokens.css` (defaults `--bg-screen`/`--ui-panel`)
- Modify: `tests/render/packs.test.ts` (assert `bgScreen`)
- Modify: `src/app/theme.test.ts` (assert `--bg-screen`/`--ui-panel`)

**Interfaces:**
- Consumes: `LookPack`/`packForId`/`PACK_CLASSIC` (packs); `applyPackTheme` (theme).
- Produces: `LookPack.bgScreen: string`; `applyPackTheme` também escreve `--bg-screen`/`--ui-panel` em `:root`.

- [ ] **Step 1: Escrever os testes que falham** — em `tests/render/packs.test.ts` (novo `describe`):

```ts
describe('bgScreen por pack', () => {
  it('cada pack aponta seu fundo de tela', () => {
    expect(PACK_CLASSIC.bgScreen).toBe('bg.screen.classic');
    expect(packForId('volcano').bgScreen).toBe('bg.screen.volcano');
    expect(packForId('glacier').bgScreen).toBe('bg.screen.glacier');
  });
});
```
(garanta que `PACK_CLASSIC` está importado no arquivo — já está.)

Em `src/app/theme.test.ts` (novo `it` no describe existente):

```ts
it('applyPackTheme seta --bg-screen e --ui-panel', () => {
  applyPackTheme(packForId('volcano'));
  const bg = document.documentElement.style.getPropertyValue('--bg-screen');
  const panel = document.documentElement.style.getPropertyValue('--ui-panel');
  expect(bg).toContain('ui/bg.screen.volcano.png');
  expect(panel).toContain('ui/panel.png');
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run tests/render/packs.test.ts src/app/theme.test.ts`
Expected: FAIL (`bgScreen` indefinido; custom properties vazias).

- [ ] **Step 3: `src/render/packs.ts`** — na interface `LookPack`, adicionar:

```ts
  /** Nome do fundo de tela em public/ui/ (por expansão ativa). Seam Tier-1 (8.1). */
  readonly bgScreen: string;
```
E em cada pack, adicionar a propriedade: `PACK_CLASSIC` → `bgScreen: 'bg.screen.classic',`; `PACK_VOLCANO` → `bgScreen: 'bg.screen.volcano',`; `PACK_GLACIER` → `bgScreen: 'bg.screen.glacier',`.

- [ ] **Step 4: `src/app/theme.ts`** — no corpo de `applyPackTheme`, após o loop das cores:

```ts
  const base = import.meta.env.BASE_URL; // termina com '/'
  root.style.setProperty('--bg-screen', `url(${base}ui/${pack.bgScreen}.png)`);
  root.style.setProperty('--ui-panel', `url(${base}ui/panel.png)`);
```

- [ ] **Step 5: `src/app/styles/tokens.css`** — dentro de `:root`, adicionar (defaults pré-JS, evitam border-image/bg inválidos):

```css
  /* Assets de UI Tier-1 (o theme.ts sobrescreve com BASE_URL correto por expansão). */
  --bg-screen: none;
  --ui-panel: none;
```

- [ ] **Step 6: Rodar — deve PASSAR + suíte + tipos**

Run: `npx vitest run tests/render/packs.test.ts src/app/theme.test.ts && npm run check`
Expected: PASS; tsc/eslint limpos.

- [ ] **Step 7: Commit**

```bash
git add src/render/packs.ts src/app/theme.ts src/app/styles/tokens.css tests/render/packs.test.ts src/app/theme.test.ts
git commit -m "feat(8.1): pack.bgScreen + theme seta --bg-screen/--ui-panel por expansão"
```

---

### Task 3: CSS de fundo + painel 9-slice + logo na Home

**Files:**
- Modify: `src/app/styles/global.css` (fundo no `body`; painel em `.screen`/`.home`; `.home__logo`)
- Modify: `src/app/screens/HomeScreen.tsx` (`<img>` do logo)

**Interfaces:**
- Consumes: custom properties `--bg-screen`/`--ui-panel` (Task 2); `public/ui/{panel,logo,bg.screen.*}.png` (Task 1).
- Produces: nenhuma API (casca CSS/DOM; validado no Playwright da Task 4).

- [ ] **Step 1: Fundo de tela no `body`** — em `src/app/styles/global.css`, substituir a regra `body { ... }` (linhas ~14-20) por:

```css
body {
  font-family: var(--font-family);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background-color: var(--color-bg); /* fallback/letterbox sob a imagem */
  background-image: var(--bg-screen); /* pintado por expansão (theme.ts); `none` pré-JS */
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Painel 9-slice em `.screen` e `.home`** — em `global.css`, adicionar ao final:

```css
/* Painel 9-slice (Tier-1 8.1): moldura ornamentada + centro translúcido escuro (o `fill`)
   ⇒ menus legíveis sobre o fundo pintado. NÃO se aplica a .play-screen (o jogo). O centro
   translúcido vem da arte; o border-image escala para qualquer tamanho de caixa. */
.screen,
.home {
  border: 22px solid transparent;
  border-image: var(--ui-panel) 12% fill / 22px / 0 stretch;
}
```

- [ ] **Step 3: Estilo do logo** — em `global.css`, adicionar ao final:

```css
.home__logo {
  display: block;
  align-self: center;
  width: min(80%, 22rem);
  height: auto;
  margin: 0 auto var(--space-2);
}
```

- [ ] **Step 4: Logo na Home** — em `src/app/screens/HomeScreen.tsx`, dentro do `<div class="home">`, logo após a `<h1 class="sr-only">` existente, adicionar:

```tsx
      <img class="home__logo" src={`${import.meta.env.BASE_URL}ui/logo.png`} alt="" />
```
(`alt=""` decorativo — o título acessível já vive na `h1.sr-only`.)

- [ ] **Step 5: Verificar tipos + suíte**

Run: `npm run check && npm test`
Expected: tsc/eslint limpos; suíte verde (sem teste de unidade novo — casca CSS/DOM; validação visual na Task 4). Determinismo intocado.

- [ ] **Step 6: Commit**

```bash
git add src/app/styles/global.css src/app/screens/HomeScreen.tsx
git commit -m "feat(8.1): fundo por expansão + painel 9-slice nos menus + logo na Home"
```

---

### Task 4 (controlador, inline): validação visual + docs

Não é subagente — usa Playwright MCP e edita docs.

- [ ] **Step 1:** `npm run build` + `npx vite preview`; Playwright (390×844 retrato e 844×390 paisagem). Home: logo visível no topo; menu sobre painel 9-slice sobre o fundo pintado `bg.screen.classic`; texto legível; sem scroll horizontal.
- [ ] **Step 2:** Trocar expansão (Expansões → desbloquear/selecionar volcano, depois glacier): o **fundo troca AO VIVO** (classic→volcano→glacier) e o painel permanece. Amostrar `getComputedStyle(document.body).backgroundImage` p/ confirmar a URL do fundo por expansão.
- [ ] **Step 3:** Conferir precache do build (`npm run build`) — `public/ui/*` entram no precache (não estão sob `art/`); registrar o novo total.
- [ ] **Step 4:** Registrar evidência; atualizar `docs/roadmap/PHASE-08-art-and-packs.md` (8.1 Tier-1 rodada A) e o **Estado atual** do `CLAUDE.md`. Commit das docs.

**Gotcha (7.2/8.3):** o SW pode servir `dist/` antigo. Se o fundo não trocar: `unregister()` + limpar caches + `?nocache=<ts>`.

## Self-Review

- **Cobertura do spec:** gen-ui → public/ui (T1) ✓; fundo por expansão via pack+theme (T2) ✓; painel 9-slice legibilidade (T3) ✓; logo na Home (T3) ✓; validação AO VIVO + docs (T4) ✓; core intocado em todas ✓.
- **Placeholders:** nenhum — código/comando/expected reais em cada passo.
- **Consistência de tipos:** `UI_SOURCES`/`renderUi` definidos em T1 e usados no teste; `bgScreen:string` em `LookPack` (T2) consumido por `applyPackTheme` (T2) e o nome do arquivo casa os `out` de `UI_SOURCES` (T1: `bg.screen.classic` etc.); `--bg-screen`/`--ui-panel` setados em T2 e consumidos pelo CSS em T3; `public/ui/panel.png`/`logo.png` gerados em T1 e referenciados em T3.
- **Fronteiras:** T1 build/assets; T2 dados+tema (testável); T3 casca CSS/DOM; T4 validação/docs do controlador.
