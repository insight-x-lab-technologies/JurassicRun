# Parallax em camadas com transparência (9.1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar as 3 bandas opacas de parallax por 4 camadas com canal alpha (far/mid/near/impact)
que deixam o backdrop vazar, matando a costura de tiling e dando profundidade real.

**Architecture:** Placeholder alpha procedural (REGRA 2 — arte real dropa depois só trocando os
PNG-fonte). Um gerador novo escreve 12 PNGs-fonte alpha; `gen-ui.mjs` os processa em modo single
alpha-preservando; `parallax.ts`/`packs.ts` ganham a 4ª camada; `GameScene` é data-driven e
auto-estende. `src/core/` **intocado**.

**Tech Stack:** Node ESM scripts (zero dep, reusa `encodePng`/`decodePng`/`loadArt`/`cropResize`),
TypeScript estrito, Phaser (render), Vitest.

## Global Constraints

- **REGRA 1 (determinismo):** `src/core/` **NÃO é tocado**. Determinismo **67** inalterado, sem
  re-pin de goldens. Sem `Math.random`/`Date.now` no core (nenhum arquivo de core neste plano).
- **REGRA 2 (arte desacoplada):** trocar look = trocar PNG-fonte, nunca lógica. Placeholder agora,
  arte real depois nos mesmos paths.
- **REGRA 3 (performance):** zero alocação por frame no hot path. O `update` do parallax segue só
  setando `tilePositionX` (escalares).
- **Justiça/legibilidade (TRAVADA):** campo lógico fixo 320×180; **nenhuma camada de parallax
  oclui o mundo** — as 4 ficam em depth negativo (atrás das entidades). `impact` = frontmost de
  fundo, não foreground-na-frente.
- Scripts de asset são **determinísticos** e os PNGs gerados são **committados**; testes comparam
  o commitado com o regerado.
- i18n: sem strings de UI novas (feature de render).

---

### Task 1: Gerador de placeholders alpha (12 PNGs-fonte)

**Files:**
- Create: `scripts/gen-parallax-placeholder.mjs`
- Modify: `package.json` (script `gen:parallax`)
- Create (gerados, commit): `public/art/themes/{classic,volcano,glacier}/parallax/{far,mid,near,impact}.png`
- Test: `tests/render/parallax-placeholder.test.ts`

**Interfaces:**
- Consumes: `encodePng(width, height, rgba)` de `scripts/gen-icons.mjs` (rgba = Buffer w*h*4, RGBA).
- Produces: `export const PARALLAX_PLACEHOLDER_SPECS` (array `{theme,layer,w,h,file}`) e
  `export function renderPlaceholder(theme, layer)` → `{ w, h, pixels: Buffer }` (usado pelo teste).

- [ ] **Step 1: Write the failing test**

```ts
// tests/render/parallax-placeholder.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PARALLAX_PLACEHOLDER_SPECS, renderPlaceholder } from '../../scripts/gen-parallax-placeholder.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('gerador de parallax placeholder (alpha)', () => {
  it('cobre 3 temas × 4 camadas = 12 fontes', () => {
    expect(PARALLAX_PLACEHOLDER_SPECS).toHaveLength(12);
    const layers = new Set(PARALLAX_PLACEHOLDER_SPECS.map((s) => s.layer));
    expect([...layers].sort()).toEqual(['far', 'impact', 'mid', 'near']);
  });

  it('cada render tem topo 100% transparente e base com conteúdo (alpha vaza)', () => {
    for (const spec of PARALLAX_PLACEHOLDER_SPECS) {
      const { w, h, pixels } = renderPlaceholder(spec.theme, spec.layer);
      expect(w).toBe(spec.w);
      expect(h).toBe(spec.h);
      // linha do topo: todo alpha 0
      let topAlpha = 0;
      for (let x = 0; x < w; x++) topAlpha += pixels[(0 * w + x) * 4 + 3];
      expect(topAlpha, `${spec.theme}.${spec.layer} topo`).toBe(0);
      // alguma opacidade no total (silhueta existe)
      let anyOpaque = 0;
      for (let i = 0; i < w * h; i++) if (pixels[i * 4 + 3] > 200) anyOpaque++;
      expect(anyOpaque, `${spec.theme}.${spec.layer} conteúdo`).toBeGreaterThan(0);
    }
  });

  it('é tileável na horizontal: coluna 0 == coluna w (mesma silhueta ao envolver)', () => {
    const { w, h, pixels } = renderPlaceholder('classic', 'far');
    // a última coluna deve casar com a primeira (continuidade do perfil periódico)
    for (let y = 0; y < h; y++) {
      const a0 = pixels[(y * w + 0) * 4 + 3];
      const aL = pixels[(y * w + (w - 1)) * 4 + 3];
      expect(Math.abs(a0 - aL), `y=${y}`).toBeLessThanOrEqual(8);
    }
  });

  it('é determinístico', () => {
    const a = renderPlaceholder('volcano', 'near');
    const b = renderPlaceholder('volcano', 'near');
    expect(a.pixels.equals(b.pixels)).toBe(true);
  });

  it('os 12 PNGs-fonte estão commitados', () => {
    for (const spec of PARALLAX_PLACEHOLDER_SPECS) {
      const p = path.join(ROOT, spec.file);
      expect(existsSync(p), spec.file).toBe(true);
      const buf = readFileSync(p);
      expect(buf.subarray(0, 8).toString('hex'), spec.file).toBe('89504e470d0a1a0a');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/parallax-placeholder.test.ts`
Expected: FAIL — módulo `scripts/gen-parallax-placeholder.mjs` não existe.

- [ ] **Step 3: Write the generator**

```js
// scripts/gen-parallax-placeholder.mjs
// Gera PNGs-fonte PLACEHOLDER alpha para o parallax (9.1). Silhuetas tileáveis com topo
// transparente; a arte AAA real (Apêndice A.1 da Fase 9) dropa depois nos MESMOS paths (REGRA 2).
// Determinístico, zero dep, reusa encodePng. Rode `npm run gen:parallax`.
import { encodePng } from './gen-icons.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THEMES = ['classic', 'volcano', 'glacier'];
const W = 2048;

// Dims por camada (Apêndice A.1). far/mid 384, near 448, impact 512.
const LAYERS = {
  far:    { h: 384, fill: 0.36, amp: 46,  sparse: false },
  mid:    { h: 384, fill: 0.52, amp: 74,  sparse: false },
  near:   { h: 448, fill: 0.66, amp: 104, sparse: false },
  impact: { h: 512, fill: 0.55, amp: 150, sparse: true  },
};

// [r,g,b] por tema × camada (silhueta). Paleta coerente com o Style Bible; placeholder.
const COLOR = {
  classic: { far: [74, 107, 58],  mid: [58, 93, 46],  near: [47, 107, 47], impact: [36, 64, 26] },
  volcano: { far: [90, 58, 52],   mid: [74, 42, 36],  near: [58, 32, 28],  impact: [255, 90, 30] },
  glacier: { far: [188, 214, 230], mid: [168, 196, 214], near: [144, 176, 192], impact: [111, 138, 154] },
};

// Harmônicos periódicos sobre W ⇒ borda esquerda casa com a direita (tileável). Fases fixas por
// (theme,layer) via hash simples ⇒ variação entre camadas sem aleatoriedade.
function phaseSeed(theme, layer) {
  const s = theme + ':' + layer;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 0xffffffff; // [0,1)
}

// Altura da silhueta (a partir do fundo, em px) na coluna x. Perfil periódico bounded em [0,1].
function profile01(x, theme, layer, amp) {
  const p = phaseSeed(theme, layer) * Math.PI * 2;
  const t = (x / W) * Math.PI * 2;
  const n = (Math.sin(t + p) + 0.5 * Math.sin(2 * t + p * 1.7) + 0.25 * Math.sin(3 * t + p * 2.3)) / 1.75;
  return (n + 1) / 2; // [0,1]
}

export const PARALLAX_PLACEHOLDER_SPECS = THEMES.flatMap((theme) =>
  Object.keys(LAYERS).map((layer) => ({
    theme, layer, w: W, h: LAYERS[layer].h,
    file: `public/art/themes/${theme}/parallax/${layer}.png`,
  })),
);

export function renderPlaceholder(theme, layer) {
  const L = LAYERS[layer];
  const h = L.h;
  const [r, g, b] = COLOR[theme][layer];
  const px = Buffer.alloc(W * h * 4); // tudo transparente por padrão (topo garantido)
  const baseFill = Math.round(h * L.fill); // altura média da silhueta a partir do fundo
  for (let x = 0; x < W; x++) {
    // colunas esparsas do impact: só ~30% das colunas têm elemento (blocos de 64px), resto vazio
    if (L.sparse) {
      const block = Math.floor(x / 64);
      if (phaseSeed(theme, layer + ':' + block) > 0.32) continue; // ~68% vazio ⇒ ~70% transparente
    }
    const top = h - (baseFill + Math.round((profile01(x, theme, layer, L.amp) - 0.5) * L.amp));
    const y0 = Math.max(0, Math.min(h, top));
    for (let y = y0; y < h; y++) {
      const i = (y * W + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return { w: W, h, pixels: px };
}

function main() {
  for (const spec of PARALLAX_PLACEHOLDER_SPECS) {
    const dir = path.join(ROOT, path.dirname(spec.file));
    mkdirSync(dir, { recursive: true });
    const { w, h, pixels } = renderPlaceholder(spec.theme, spec.layer);
    writeFileSync(path.join(ROOT, spec.file), encodePng(w, h, pixels));
    console.log(`escrito ${spec.file}`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Add npm script**

Em `package.json`, após a linha `"gen:ui": ...`, adicionar:
```json
    "gen:parallax": "node scripts/gen-parallax-placeholder.mjs",
```

- [ ] **Step 5: Generate the 12 source PNGs**

Run: `npm run gen:parallax`
Expected: imprime 12 linhas `escrito public/art/themes/<tema>/parallax/<layer>.png`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/render/parallax-placeholder.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 7: Commit**

```bash
git add scripts/gen-parallax-placeholder.mjs package.json tests/render/parallax-placeholder.test.ts public/art/themes
git commit -m "feat(art): gerador de parallax placeholder alpha (9.1 task 1)"
```

---

### Task 2: gen-ui em modo alpha + regerar public/ui + aposentar o legado

**Files:**
- Modify: `scripts/gen-ui.mjs:40-70` (trocar entradas de parallax por 12 alpha single)
- Modify: `tests/render/gen-ui.test.ts:85-94` (asserção das tiras)
- Modify: `tests/render/parallax-chroma.test.ts:21` (4 camadas)
- Delete: `public/ui/parallax.far.png`, `public/ui/parallax.mid.png`, `public/ui/parallax.near.png` (órfãos legado)
- Create/overwrite (gerados, commit): `public/ui/parallax.{far,mid,near,impact}.{classic,volcano,glacier}.png` (12)

**Interfaces:**
- Consumes: PNGs-fonte da Task 1 (`public/art/themes/<tema>/parallax/<layer>.png`).
- Produces: 12 saídas `parallax.<layer>.<tema>` de `renderUi()` (consumidas por `packs.ts` na Task 3).

- [ ] **Step 1: Update the gen-ui test first (parallax outputs = 4 tiras)**

Em `tests/render/gen-ui.test.ts`, substituir o teste "gera as 3 tiras de parallax" por:
```ts
  it(
    'gera as 4 tiras de parallax por tema (far/mid/near/impact × 3 temas)',
    () => {
      const names = renderUi().map((o) => o.out);
      for (const theme of ['classic', 'volcano', 'glacier']) {
        for (const layer of ['far', 'mid', 'near', 'impact']) {
          expect(names, `parallax.${layer}.${theme}`).toContain(`parallax.${layer}.${theme}`);
        }
      }
    },
    60000,
  );
```

- [ ] **Step 2: Update parallax-chroma test to 4 layers**

Em `tests/render/parallax-chroma.test.ts`, trocar a linha `const layers = ['far', 'mid', 'near'] as const;`
por `const layers = ['far', 'mid', 'near', 'impact'] as const;`.

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/render/gen-ui.test.ts tests/render/parallax-chroma.test.ts`
Expected: FAIL — faltam saídas `parallax.impact.*` e os arquivos `parallax.impact.*.png` não existem;
o committed-match ainda espera as fontes antigas.

- [ ] **Step 4: Replace the parallax entries in gen-ui.mjs**

Em `scripts/gen-ui.mjs`, **remover** o bloco legado (a entrada `{ out: 'parallax', file:
'parallax/bg.layers.png', ... }` com `padBottomTo`) **e** as 3 entradas `parallax.theme.<tema>`
(chroma/hardAlpha). No lugar, inserir 12 entradas single alpha geradas por tema × camada:

```js
  // Parallax alpha por tema (9.1): silhuetas com canal alpha. Modo single com `opaque:true` =
  // SEM content-trim (preserva o frame tileável inteiro; cropResize preserva o alpha). SEM
  // chroma/hardAlpha/padBottomTo — a transparência já vem do PNG-fonte.
  ...['classic', 'volcano', 'glacier'].flatMap((theme) =>
    ['far', 'mid', 'near', 'impact'].map((layer) => ({
      out: `parallax.${layer}.${theme}`,
      file: `parallax/${layer}.png`,
      root: `public/art/themes/${theme}`,
      maxDim: 2048,
      opaque: true,
    })),
  ),
```

(As funções `padBottom`/`trimChromaEdges`/`hardCutAlpha` podem permanecer no arquivo — nenhuma
fonte de parallax as invoca mais; não removê-las evita mexer em código não relacionado.)

- [ ] **Step 5: Delete orphan legacy runtime PNGs**

Run:
```bash
git rm public/ui/parallax.far.png public/ui/parallax.mid.png public/ui/parallax.near.png
```
Expected: remove os 3 arquivos legado não-tema (nada os consome; a asserção que os cobria virou 4-tiras).

- [ ] **Step 6: Regenerate public/ui**

Run: `npm run gen:ui`
Expected: escreve, entre outros, `public/ui/parallax.{far,mid,near,impact}.{classic,volcano,glacier}.png` (12).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/render/gen-ui.test.ts tests/render/parallax-chroma.test.ts`
Expected: PASS (inclui committed-match e chroma-edge zero para as 12 tiras).

- [ ] **Step 8: Commit**

```bash
git add scripts/gen-ui.mjs tests/render/gen-ui.test.ts tests/render/parallax-chroma.test.ts public/ui
git commit -m "feat(render): gen-ui processa parallax alpha por tema; aposenta bandas opacas (9.1 task 2)"
```

---

### Task 3: 4ª camada em PARALLAX_LAYERS + packs 4-tupla + constante

**Files:**
- Modify: `src/render/parallax.ts:26-46` (4 camadas)
- Modify: `src/render/packs.ts` (4-tupla `parallaxTextures` + impact por tema + array `parallax` 3→4 em volcano/glacier)
- Modify: `src/render/constants.ts:15` (`PARALLAX_SOURCE_WORLD_WIDTH`)
- Modify: `tests/render/parallax.test.ts:11` (ids com `bg.layer.impact`)

**Interfaces:**
- Consumes: saídas `parallax.<layer>.<tema>` da Task 2.
- Produces: `PARALLAX_LAYERS` (4 camadas) e `LookPack.parallaxTextures` (4-tupla) consumidos pelo
  `GameScene` (Task 4, sem mudança de código — data-driven).

- [ ] **Step 1: Update parallax.test.ts to expect 4 ids**

Em `tests/render/parallax.test.ts`, trocar a asserção de ids por:
```ts
    expect(ids).toEqual(['bg.layer.far', 'bg.layer.mid', 'bg.layer.near', 'bg.layer.impact']);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/render/parallax.test.ts`
Expected: FAIL — `PARALLAX_LAYERS` ainda tem 3 camadas.

- [ ] **Step 3: Add the 4th layer + recalibrate in parallax.ts**

Substituir o array `PARALLAX_LAYERS` em `src/render/parallax.ts` por (scrollFactor 0.15/0.35/0.6/0.85;
dispHeight/baseFromBottom são valores iniciais — a Task 4 calibra por Playwright):
```ts
export const PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    id: 'bg.layer.far',
    scrollFactor: 0.15,
    visual: { kind: 'sprite', texture: 'parallax.far', baseFromBottom: 0, dispHeight: 110 },
  },
  {
    id: 'bg.layer.mid',
    scrollFactor: 0.35,
    visual: { kind: 'sprite', texture: 'parallax.mid', baseFromBottom: 0, dispHeight: 95 },
  },
  {
    id: 'bg.layer.near',
    scrollFactor: 0.6,
    visual: { kind: 'sprite', texture: 'parallax.near', baseFromBottom: 0, dispHeight: 90 },
  },
  {
    id: 'bg.layer.impact',
    scrollFactor: 0.85,
    visual: { kind: 'sprite', texture: 'parallax.impact', baseFromBottom: 0, dispHeight: 80 },
  },
];
```
Atualizar o comentário de bloco do array para refletir 4 camadas alpha (far/mid/near/impact) e o
scrollFactor novo. A `texture` aqui é o nome-base; o `GameScene` usa `pack.parallaxTextures[index]`
(o nome com sufixo de tema), então esses valores base são só documentais/fallback.

- [ ] **Step 4: Extend packs.ts to a 4-tuple + impact texture per theme**

Em `src/render/packs.ts`:
1. Na interface `LookPack`, mudar o tipo de `parallaxTextures` para 4-tupla:
```ts
  readonly parallaxTextures: readonly [string, string, string, string];
```
2. `PACK_CLASSIC.parallaxTextures`:
```ts
  parallaxTextures: ['parallax.far.classic', 'parallax.mid.classic', 'parallax.near.classic', 'parallax.impact.classic'],
```
3. `PACK_VOLCANO`: `parallax` de 3→4 entradas e `parallaxTextures` 4:
```ts
  parallax: [{ color: 0xffffff }, { color: 0xffffff }, { color: 0xffffff }, { color: 0xffffff }],
  parallaxTextures: ['parallax.far.volcano', 'parallax.mid.volcano', 'parallax.near.volcano', 'parallax.impact.volcano'],
```
4. `PACK_GLACIER`: idem com `.glacier`:
```ts
  parallax: [{ color: 0xffffff }, { color: 0xffffff }, { color: 0xffffff }, { color: 0xffffff }],
  parallaxTextures: ['parallax.far.glacier', 'parallax.mid.glacier', 'parallax.near.glacier', 'parallax.impact.glacier'],
```
(`PACK_CLASSIC.parallax` = `CLASSIC_PARALLAX` = `PARALLAX_LAYERS.map(...)` ⇒ já vira 4 automaticamente.)

- [ ] **Step 5: Recalibrate PARALLAX_SOURCE_WORLD_WIDTH**

Em `src/render/constants.ts:15`, ajustar para a densidade da fonte nova (2048px de largura). Valor
inicial:
```ts
export const PARALLAX_SOURCE_WORLD_WIDTH = 1024;
```
Atualizar o comentário adjacente para mencionar a fonte 2048 do 9.1 (a Task 4 confirma o valor por
verificação visual da frequência de emenda).

- [ ] **Step 6: Run the render suite to verify green**

Run: `npx vitest run tests/render/parallax.test.ts src/render/packs.test.ts src/render/resolution.test.ts`
Expected: PASS (parallax ids 4; packs itera `PARALLAX_LAYERS` ⇒ auto-4; classic zero-regressão).

- [ ] **Step 7: Typecheck**

Run: `npm run check`
Expected: sem erros (4-tupla satisfaz o tipo; `GameScene` `parallaxTextures[index]` cobre índice 3).

- [ ] **Step 8: Commit**

```bash
git add src/render/parallax.ts src/render/packs.ts src/render/constants.ts tests/render/parallax.test.ts
git commit -m "feat(render): 4ª camada de parallax (impact) + tuplas de tema (9.1 task 3)"
```

---

### Task 4: Fiação do GameScene, calibração Playwright e docs

**Files:**
- Verify/Modify: `src/render/GameScene.ts:91-137` (preload + create do parallax — provavelmente sem
  mudança de código; confirmar que carrega as 4 texturas do pack)
- Modify (calibração): `src/render/parallax.ts` (dispHeight/baseFromBottom), `src/render/constants.ts`
  (PARALLAX_SOURCE_WORLD_WIDTH) — só se a verificação visual pedir
- Modify: `docs/assets/asset-registry.md`, `docs/assets/specs/bg.layer.far.md`/`bg.layer.mid.md`/
  `bg.layer.near.md` (+ criar `bg.layer.impact.md`)

**Interfaces:**
- Consumes: `PARALLAX_LAYERS` (4) e `pack.parallaxTextures` (4-tupla) da Task 3; as 12 tiras da Task 2.

- [ ] **Step 1: Confirm GameScene loads all 4 textures**

Ler `src/render/GameScene.ts` `preload()`/`create()`. O `preload` faz
`for (const tex of pack.parallaxTextures) this.load.image(...)` e o `create` mapeia
`PARALLAX_LAYERS.map((layer,index)=> ... createPack.parallaxTextures[index]!)`. Como ambos agora
têm 4 elementos, deve funcionar sem edição. **Se** houver qualquer suposição de 3 (ex.: índice
literal), corrigir para ser data-driven. Não introduzir alocação por frame.

- [ ] **Step 2: Full build + suite green**

Run: `npm run check && npm test`
Expected: `check` limpo; **todos** os testes verdes (contagem anterior + parallax-placeholder novos).
Anotar a contagem de testes.

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build OK; `dist/` inclui `ui/parallax.*.png` (12) e não referencia os `parallax.{far,mid,near}.png` removidos.

- [ ] **Step 4: Calibração visual (Playwright)**

Servir o build (`npm run preview` ou o fluxo Playwright do projeto) e, numa partida ativa nos 3
temas, verificar:
- 4 camadas visíveis com profundidade; o backdrop `bg.screen` **vaza** pelos topos transparentes.
- **Sem costura de tiling visível** durante o scroll (ajustar `PARALLAX_SOURCE_WORLD_WIDTH` se a
  emenda aparecer com frequência ruim; ajustar `dispHeight`/`baseFromBottom` se uma camada flutuar
  ou cortar).
- Tint de dia/noite preservado (as tiras recebem `parallaxTint`).
- **60fps** (medição rAF real, molde de 8.2: p50 ≈ 16,7ms, 0 frames > 50ms).
Se ajustou constantes de calibração, `npm test` de novo e recommit a Task 3 (ou incluir no commit
desta task).

> **Nota de execução:** a calibração/Playwright é feita **inline pelo controlador** (precedente do
> projeto — validação visual não vai a subagente fresco). O subagente da Task 4 faz Steps 1–3 e 5.

- [ ] **Step 5: Docs — registry + asset-specs**

Atualizar `docs/assets/asset-registry.md`: a seção de parallax passa a listar 4 camadas
(`bg.layer.impact` novo) com fonte `public/art/themes/<tema>/parallax/<layer>.png` (status
`placeholder`→`art` quando a arte real chegar). Atualizar `docs/assets/specs/bg.layer.{far,mid,near}.md`
para o modelo alpha (topo transparente, tileável) e **criar** `docs/assets/specs/bg.layer.impact.md`
(reusar o prompt do Apêndice A.1 impact). Manter a guarda `tests/assets/registry-specs.test.ts` verde.

- [ ] **Step 6: Commit**

```bash
git add src/render docs/assets
git commit -m "feat(render): fiação/calibração das 4 camadas de parallax + specs (9.1 task 4)"
```

---

## Self-Review (cobertura do spec)

- Placeholder alpha gerado + committado → Task 1. ✅
- gen-ui modo single alpha, sem chroma/hardAlpha/pad → Task 2 Step 4. ✅
- Aposentar legado opaco (chroma + bg.layers) → Task 2 Steps 4–5. ✅
- 4ª camada `impact`, scrollFactor 0.15/0.35/0.6/0.85 → Task 3 Step 3. ✅
- Recalibrar PARALLAX_LAYERS + PARALLAX_SOURCE_WORLD_WIDTH → Task 3 Steps 3,5 + Task 4 Step 4. ✅
- packs 4-tupla + impact por tema → Task 3 Step 4. ✅
- GameScene data-driven (4 camadas, depth auto) → Task 4 Step 1. ✅
- Impact = camada de fundo (justiça travada) → depth `-(length-index)` negativo, decisão no spec. ✅
- Testes: parallax (ids), gen-ui (4 tiras), parallax-chroma (12), packs (auto), placeholder novo. ✅
- Aceite: profundidade/alpha/sem-costura/daynight/60fps → Task 4 Step 4. ✅
- Determinismo 67 intocado (core não tocado) → Global Constraints; suíte completa Task 4 Step 2. ✅
- Docs registry + specs → Task 4 Step 5. ✅

Sem placeholders de plano; tipos consistentes (`parallaxTextures` 4-tupla usada igual em packs e
GameScene; `renderPlaceholder`/`PARALLAX_PLACEHOLDER_SPECS` idênticos entre gerador e teste).
