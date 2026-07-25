# Obstáculos por composição de segmentos (9.2) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** obstáculos aabb (tree/vine) cobrem 100% da hitbox de altura variável montando `cap + N×body + base`, em vez de esticar 1 sprite — sem tocar o core/colisão.

**Architecture:** puro×casca. Helpers puros (layout + resolução de frames) em `sprites.ts`; casca de composição na `GameScene` (pool de `Image` existente, alocação-zero). Pipeline de atlas ganha modo `parts` e é alimentado por um placeholder procedural (arte real dropa depois trocando os PNG-fonte).

**Tech Stack:** TypeScript estrito, Phaser (só casca), Vitest, encoder PNG puro node (`gen-icons.mjs`).

## Global Constraints
- **Determinismo (REGRA 1):** `src/core/` **intocado**; nada de `Math.random`/`Date.now` no core. Este item não toca core ⇒ determinismo **67 inalterado**, sem re-pin de goldens.
- **Arte desacoplada (REGRA 2):** colisão usa a hitbox lógica; a arte cobre a hitbox, nunca a define.
- **Performance (REGRA 3):** zero alocação por frame no hot path (scratch reusado, pool de `Image`).
- **Segmentação só para hitbox `aabb`** (tree/vine). Stalactite (polygon) e boulder (circle) seguem 1 sprite.
- Placeholder procedural agora; arte AAA real (prompts A.2 do PHASE-09) dropa trocando os PNG-fonte.
- Encoder PNG: reusar `encodePng` de `scripts/gen-icons.mjs` (zero dep nova).

---

### Task 1: Helpers puros de segmentação + flag no manifesto

**Files:**
- Modify: `src/render/manifest.ts` (flag `segmented` + marca tree/vine)
- Modify: `src/render/sprites.ts` (add `segmentFramesFor`, `layoutSegments`, tipos)
- Test: `src/render/sprites.test.ts` (append)

**Interfaces:**
- Produces: `segmentFramesFor(typeId: string): SegmentFrames | null` onde `SegmentFrames = { cap: string; body: string; base: string }`; `layoutSegments(height, capUnitH, bodyUnitH, baseUnitH, out): SegmentLayout` onde `SegmentLayout = { capH: number; baseH: number; bodyH: number; bodyN: number }`.
- Consumes (Task 4): ambos.

- [ ] **Step 1: manifesto — flag `segmented`.** Em `src/render/manifest.ts`, na união `Renderable`, adicionar ao ramo sprite o campo opcional `readonly segmented?: boolean`:
```ts
  | { readonly kind: 'sprite'; readonly atlas: string; readonly frame?: string; readonly animation?: string; readonly segmented?: boolean };
```
E marcar os dois obstáculos aabb (manter `frame` como está — só a composição usa as partes):
```ts
  'obstacle.tree': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.tree', segmented: true },
  'obstacle.vine': { kind: 'sprite', atlas: 'entities', frame: 'obstacle.vine', segmented: true },
```

- [ ] **Step 2: teste falho** (append em `src/render/sprites.test.ts`):
```ts
import { segmentFramesFor, layoutSegments, type SegmentLayout } from './sprites';

describe('segmentFramesFor', () => {
  it('devolve as 3 partes para obstáculo segmentado', () => {
    expect(segmentFramesFor('obstacle.tree')).toEqual({ cap: 'obstacle.tree.cap', body: 'obstacle.tree.body', base: 'obstacle.tree.base' });
    expect(segmentFramesFor('obstacle.vine')).toEqual({ cap: 'obstacle.vine.cap', body: 'obstacle.vine.body', base: 'obstacle.vine.base' });
  });
  it('null para não-segmentado ou desconhecido', () => {
    expect(segmentFramesFor('obstacle.boulder')).toBeNull();
    expect(segmentFramesFor('obstacle.stalactite')).toBeNull();
    expect(segmentFramesFor('desconhecido')).toBeNull();
  });
});

describe('layoutSegments', () => {
  const out: SegmentLayout = { capH: 0, baseH: 0, bodyH: 0, bodyN: 0 };
  it('obstáculo alto: cap+N×body+base cobrem exatamente a altura', () => {
    const L = layoutSegments(80, 12, 8, 8, out);
    expect(L.capH).toBe(12);
    expect(L.baseH).toBe(8);
    expect(L.bodyN).toBe(8); // ceil((80-20)/8)
    expect(L.capH + L.bodyN * L.bodyH + L.baseH).toBeCloseTo(80, 6);
  });
  it('obstáculo curtíssimo: encolhe cap/base, sem body', () => {
    const L = layoutSegments(15, 12, 8, 8, out);
    expect(L.bodyN).toBe(0);
    expect(L.capH + L.baseH).toBeCloseTo(15, 6);
    expect(L.capH).toBeCloseTo(9, 6); // 12 * 15/20
  });
  it('altura zero ⇒ tudo zero', () => {
    const L = layoutSegments(0, 12, 8, 8, out);
    expect(L).toEqual({ capH: 0, baseH: 0, bodyH: 0, bodyN: 0 });
  });
  it('muta e devolve o MESMO objeto out (alocação-zero)', () => {
    expect(layoutSegments(80, 12, 8, 8, out)).toBe(out);
  });
});
```

- [ ] **Step 3: rodar — deve falhar.** `npm test -- sprites` → FAIL (`segmentFramesFor`/`layoutSegments` inexistentes).

- [ ] **Step 4: implementar** (append em `src/render/sprites.ts`):
```ts
/** Partes de um obstáculo segmentado (aabb): empilhadas cap(topo)→body(repete)→base(fundo). */
export interface SegmentFrames { readonly cap: string; readonly body: string; readonly base: string; }

/** Frames das partes se o typeId for segmentado no manifesto, senão null. Convenção de nome:
 *  `<id>.cap` / `<id>.body` / `<id>.base` (o gen-atlas empacota com esses sufixos). */
export function segmentFramesFor(typeId: string): SegmentFrames | null {
  const r = renderableFor(typeId);
  if (r.kind !== 'sprite' || r.segmented !== true) return null;
  return { cap: `${typeId}.cap`, body: `${typeId}.body`, base: `${typeId}.base` };
}

/** Layout vertical dos segmentos para cobrir uma hitbox aabb de altura `height` (unidades de
 *  mundo). `*UnitH` = altura de exibição de cada parte já escalada pela largura da hitbox.
 *  Alocação-zero: muta e devolve `out` (scratch reusável no hot path — REGRA 3). */
export interface SegmentLayout { capH: number; baseH: number; bodyH: number; bodyN: number; }

export function layoutSegments(
  height: number,
  capUnitH: number,
  bodyUnitH: number,
  baseUnitH: number,
  out: SegmentLayout,
): SegmentLayout {
  if (height <= 0) {
    out.capH = 0; out.baseH = 0; out.bodyH = 0; out.bodyN = 0;
    return out;
  }
  const fixed = capUnitH + baseUnitH;
  if (fixed >= height) {
    // Obstáculo curtíssimo: encolhe cap/base proporcionalmente; sem corpo.
    const k = height / fixed;
    out.capH = capUnitH * k; out.baseH = baseUnitH * k; out.bodyH = 0; out.bodyN = 0;
    return out;
  }
  const bodySpace = height - fixed;
  const bodyN = Math.max(1, Math.ceil(bodySpace / bodyUnitH));
  out.capH = capUnitH; out.baseH = baseUnitH;
  out.bodyN = bodyN;
  out.bodyH = bodySpace / bodyN; // preenchimento exato (sem vão nem sobreposição)
  return out;
}
```

- [ ] **Step 5: rodar — passar + check.** `npm test -- sprites` PASS; `npm run check` limpo.

- [ ] **Step 6: commit.**
```bash
git add src/render/manifest.ts src/render/sprites.ts src/render/sprites.test.ts
git commit -m "feat(render): helpers puros de segmentação + flag segmented no manifesto (9.2)"
```

---

### Task 2: Placeholder procedural das tiras de segmento

**Files:**
- Create: `scripts/gen-obstacle-placeholder.mjs`
- Create: `scripts/gen-obstacle-placeholder.d.mts`
- Create (gerado, commitado): `public/art/themes/{classic,volcano,glacier}/obstacles/*_obstacle.{tree,vine}.segments.png` (6 arquivos)
- Modify: `package.json` (script npm)
- Test: `tests/render/obstacle-placeholder.test.ts`

**Interfaces:**
- Produces: `renderSegmentStrip(parts): Buffer` (PNG da tira horizontal `[cap|body|base]`); constantes `SEG_THEMES`, `SEG_CELL_W`, `SEG_CELL_H`.
- Consumes (Task 3): os 6 PNG-fonte.

- [ ] **Step 1: gerador** — criar `scripts/gen-obstacle-placeholder.mjs`:
```js
// scripts/gen-obstacle-placeholder.mjs
// Gera tiras de segmento placeholder [cap|body|base] por tema/obstáculo (aabb) até a arte AAA
// real (prompts A.2) chegar. Full-bleed opaco ⇒ cobre a hitbox; body é cor sólida ⇒ tileável na
// vertical. Encoder PNG puro reusado. Rode `npm run gen:obstacle-placeholder`.
import { encodePng } from './gen-icons.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SEG_CELL_W = 96;
export const SEG_CELL_H = 96;

// Paleta placeholder por tema → obstáculo → {cap, body, base} em [r,g,b].
export const SEG_THEMES = {
  classic: {
    'obstacle.tree': { cap: [0x2f, 0x6b, 0x2f], body: [0x6b, 0x4a, 0x2b], base: [0x4a, 0x33, 0x1e] },
    'obstacle.vine': { cap: [0x3a, 0x5a, 0x2a], body: [0x2f, 0x6b, 0x2f], base: [0x3a, 0x7d, 0x34] },
  },
  volcano: {
    'obstacle.tree': { cap: [0x8a, 0x2a, 0x14], body: [0x3a, 0x2a, 0x26], base: [0x22, 0x18, 0x16] },
    'obstacle.vine': { cap: [0xff, 0x5a, 0x1e], body: [0x5a, 0x24, 0x14], base: [0x8a, 0x2a, 0x14] },
  },
  glacier: {
    'obstacle.tree': { cap: [0xbf, 0xe6, 0xf2], body: [0x8f, 0xb4, 0xc8], base: [0x5a, 0x7a, 0x92] },
    'obstacle.vine': { cap: [0xbf, 0xe6, 0xf2], body: [0x9a, 0xc8, 0xdc], base: [0x6a, 0x9a, 0xb4] },
  },
};

/** Tira horizontal [cap|body|base], cada célula SEG_CELL_W×SEG_CELL_H full-bleed opaca. */
export function renderSegmentStrip(parts) {
  const w = SEG_CELL_W * 3, h = SEG_CELL_H;
  const rgba = Buffer.alloc(w * h * 4);
  const cols = [parts.cap, parts.body, parts.base];
  for (let ci = 0; ci < 3; ci++) {
    const [r, g, b] = cols[ci];
    for (let y = 0; y < h; y++) for (let x = 0; x < SEG_CELL_W; x++) {
      const i = (y * w + ci * SEG_CELL_W + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return encodePng(w, h, rgba);
}

function main() {
  for (const [theme, obstacles] of Object.entries(SEG_THEMES)) {
    const dir = path.join(ROOT, `public/art/themes/${theme}/obstacles`);
    mkdirSync(dir, { recursive: true });
    for (const [id, parts] of Object.entries(obstacles)) {
      const png = renderSegmentStrip(parts);
      writeFileSync(path.join(dir, `${theme}_${id}.segments.png`), png);
      console.log(`segments ${theme}/${id}: ${png.length} bytes`);
    }
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 2: tipos** — criar `scripts/gen-obstacle-placeholder.d.mts`:
```ts
export const SEG_CELL_W: number;
export const SEG_CELL_H: number;
export const SEG_THEMES: Record<string, Record<string, { cap: number[]; body: number[]; base: number[] }>>;
export function renderSegmentStrip(parts: { cap: number[]; body: number[]; base: number[] }): Buffer;
```

- [ ] **Step 3: script npm** — em `package.json` `scripts`, adicionar:
```json
    "gen:obstacle-placeholder": "node scripts/gen-obstacle-placeholder.mjs",
```

- [ ] **Step 4: gerar + commitar os PNG.** `npm run gen:obstacle-placeholder` (escreve os 6 arquivos).

- [ ] **Step 5: teste falho** — criar `tests/render/obstacle-placeholder.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderSegmentStrip, SEG_THEMES, SEG_CELL_W, SEG_CELL_H } from '../../scripts/gen-obstacle-placeholder.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('placeholder de segmentos de obstáculo', () => {
  it('renderSegmentStrip gera PNG assinado, largura = 3 células', () => {
    const png = renderSegmentStrip(SEG_THEMES.classic['obstacle.tree']);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(SEG_CELL_W * 3); // IHDR width
    expect(png.readUInt32BE(20)).toBe(SEG_CELL_H); // IHDR height
  });
  it('determinístico (mesmos bytes)', () => {
    const p = SEG_THEMES.classic['obstacle.vine'];
    expect(renderSegmentStrip(p).equals(renderSegmentStrip(p))).toBe(true);
  });
  it('os 6 PNG commitados batem byte-a-byte com o gerado', () => {
    for (const [theme, obstacles] of Object.entries(SEG_THEMES)) {
      for (const [id, parts] of Object.entries(obstacles)) {
        const file = path.join(root, `public/art/themes/${theme}/obstacles/${theme}_${id}.segments.png`);
        expect(readFileSync(file).equals(renderSegmentStrip(parts)), `${theme}/${id}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 6: rodar — passar + check.** `npm test -- obstacle-placeholder` PASS; `npm run check` limpo.

- [ ] **Step 7: commit.**
```bash
git add scripts/gen-obstacle-placeholder.mjs scripts/gen-obstacle-placeholder.d.mts package.json tests/render/obstacle-placeholder.test.ts public/art/themes/*/obstacles/*.segments.png
git commit -m "feat(build): placeholder procedural das tiras cap/body/base por tema (9.2)"
```

---

### Task 3: Modo `parts` no gen-atlas + rewire + regenerar atlas + guardas

**Files:**
- Modify: `scripts/gen-atlas.mjs` (modo `parts`; `ATLAS_SOURCES = themeSources('classic')`; tree/vine → parts)
- Modify (gerado, commitado): `public/atlas/entities*.{png,json}` (3 variantes)
- Modify: `tests/render/atlas.test.ts` (guardas de completude + órfão)

**Interfaces:**
- Consumes: as tiras `<theme>_obstacle.{tree,vine}.segments.png` (Task 2); a flag `segmented` (Task 1).
- Produces: frames `obstacle.tree.{cap,body,base}` / `obstacle.vine.{cap,body,base}` em cada atlas.

- [ ] **Step 1: modo `parts`.** Em `scripts/gen-atlas.mjs` `renderAtlas`, dentro do `for (const src of sources)`, adicionar um ramo ANTES do `else if (src.frames === 1)`:
```js
    } else if (src.parts) {
      // Fatia a tira horizontal em N partes iguais; largura CONSISTENTE entre partes (união do
      // X-bbox) e altura PRÓPRIA por parte. Escala única (mesma p/ todas) ⇒ dw idêntico ⇒ empilham
      // alinhadas. Emite frames `<id>.<parte>`.
      const names = src.parts, n = names.length;
      const cw = Math.floor(img.w / n);
      let uMinX = cw, uMaxX = 0;
      const cells = [];
      for (let i = 0; i < n; i++) {
        const b = contentBounds(img, i * cw, 0, i * cw + cw, img.h);
        uMinX = Math.min(uMinX, b.minX - i * cw); uMaxX = Math.max(uMaxX, b.maxX - i * cw);
        cells.push(b);
      }
      const sw = uMaxX - uMinX;
      const maxSh = Math.max(...cells.map((b) => b.maxY - b.minY));
      const s = Math.min(1, CELL_MAX / Math.max(sw, maxSh));
      const dw = Math.max(1, Math.round(sw * s));
      for (let i = 0; i < n; i++) {
        const b = cells[i], sh = b.maxY - b.minY, dh = Math.max(1, Math.round(sh * s));
        frames.push({ name: `${src.id}.${names[i]}`, dw, dh, pixels: cropResize(img, i * cw + uMinX, b.minY, sw, sh, dw, dh) });
      }
    }
```

- [ ] **Step 2: rewire tree/vine + unificar default.** Em `themeSources`, trocar as entradas tree e vine por tiras de segmento; e apontar `ATLAS_SOURCES` para a variante classic (remove a divergência final/×themes/). Resultado do `themeSources`:
```js
function themeSources(theme) {
  const R = `public/art/themes/${theme}`;
  return [
    { id: 'dino.default', root: R, file: `dinos/${theme}_dino.default.flap.chromakey.png`, frames: 6, chroma: true },
    { id: 'obstacle.tree', root: R, file: `obstacles/${theme}_obstacle.tree.segments.png`, parts: ['cap', 'body', 'base'] },
    { id: 'obstacle.vine', root: R, file: `obstacles/${theme}_obstacle.vine.segments.png`, parts: ['cap', 'body', 'base'] },
    { id: 'bird.coin', root: R, file: `collectibles/${theme}_bird.coin.chromakey.png`, frames: 1, chroma: true },
    {
      id: 'powerups', root: R, file: `powerups/${theme}_powerups.chromakey.png`, chroma: true,
      grid: {
        cols: 3, rows: 2,
        names: ['powerup.shield', 'powerup.extraLife', 'powerup.magnet', 'powerup.doubleCoin', 'powerup.slowMo', null],
      },
    },
    { id: 'obstacle.boulder', file: 'obstacles/obstacle.boulder.png', frames: 1 },
    { id: 'obstacle.stalactite', file: 'obstacles/obstacle.stalactite.png', frames: 1 },
  ];
}

// Default (test-only) = variante classic — sem divergência com o `entities` que de fato ship.
export const ATLAS_SOURCES = themeSources('classic');
```
Remover o antigo `export const ATLAS_SOURCES = [...]` (bloco de single-frames de `final/`). Mover `themeSources` para ANTES de `ATLAS_SOURCES` e de `ATLAS_VARIANTS`.

- [ ] **Step 3: regenerar atlas.** `npm run gen:atlas` (reescreve `public/atlas/entities*.{png,json}`).

- [ ] **Step 4: atualizar guardas** em `tests/render/atlas.test.ts` — as 2 guardas de completude e a de órfão passam a entender segmentados. Substituir o teste "COMPLETUDE" (linha ~34) e o "COMPLETUDE POR VARIANTE" (linha ~43) e o "sem frame órfão" (linha ~65) por:
```ts
  const SEG_PARTS = ['cap', 'body', 'base'] as const;

  it('COMPLETUDE: todo id sprite do manifesto tem frame(s) no atlas', () => {
    const { json } = renderAtlas();
    for (const [id, r] of Object.entries(ASSET_MANIFEST)) {
      if (r.kind !== 'sprite') continue;
      if (r.segmented) {
        for (const part of SEG_PARTS) {
          expect(json.frames[`${id}.${part}`], `segmentado sem parte: ${id}.${part}`).toBeDefined();
        }
      } else {
        expect(json.frames[id], `manifesto sprite sem frame: ${id}`).toBeDefined();
      }
    }
  });

  it('COMPLETUDE POR VARIANTE: todo id sprite do manifesto tem frame(s) em CADA atlas de tema', () => {
    for (const v of ATLAS_VARIANTS) {
      const { json } = renderAtlas(v.sources);
      for (const [id, r] of Object.entries(ASSET_MANIFEST)) {
        if (r.kind !== 'sprite') continue;
        if (r.segmented) {
          for (const part of SEG_PARTS) {
            expect(json.frames[`${id}.${part}`], `${v.key}: ${id}.${part}`).toBeDefined();
          }
        } else {
          expect(json.frames[id], `${v.key}: manifesto sprite sem frame: ${id}`).toBeDefined();
        }
      }
    }
  }, 60000);

  it('sem frame órfão: todo id (sem sufixo .N/.parte) existe no manifesto', () => {
    const { json } = renderAtlas();
    for (const name of Object.keys(json.frames)) {
      const base = name.replace(/\.(cap|body|base)$/, '').replace(/\.\d+$/, '');
      expect(ASSET_MANIFEST[base], `frame órfão: ${name}`).toBeDefined();
    }
  });
```

- [ ] **Step 5: rodar — passar + check.** `npm test -- atlas` PASS (inclui o byte-match dos 3 atlas commitados); `npm run check` limpo.

- [ ] **Step 6: commit.**
```bash
git add scripts/gen-atlas.mjs public/atlas/entities.png public/atlas/entities.json public/atlas/entities.volcano.png public/atlas/entities.volcano.json public/atlas/entities.glacier.png public/atlas/entities.glacier.json tests/render/atlas.test.ts
git commit -m "feat(build): modo parts no gen-atlas + tree/vine segmentados nos 3 atlas (9.2)"
```

---

### Task 4: Composição na GameScene + docs + validação

**Files:**
- Modify: `src/render/GameScene.ts` (`drawSegmentedEntity`, roteamento, scratch/cache)
- Modify: `docs/assets/specs/obstacle.tree.md`, `docs/assets/specs/obstacle.vine.md` (campo segmentos)
- Modify: `docs/assets/asset-registry.md` (nota de segmentação)

**Interfaces:**
- Consumes: `segmentFramesFor`, `layoutSegments`, `SegmentFrames`, `SegmentLayout` (Task 1); frames de atlas (Task 3).

- [ ] **Step 1: imports.** Em `src/render/GameScene.ts`, estender o import de `./sprites`:
```ts
import { spriteSizeFor, frameFor, atlasRefFor, segmentFramesFor, layoutSegments } from './sprites';
import type { SegmentFrames, SegmentLayout } from './sprites';
```

- [ ] **Step 2: campos scratch/cache.** Adicionar aos campos privados da classe (perto de `sizeCache`):
```ts
  private readonly segScratch: SegmentLayout = { capH: 0, baseH: 0, bodyH: 0, bodyN: 0 };
  private readonly segDimCache = new Map<string, { partW: number; capH: number; bodyH: number; baseH: number }>();
```

- [ ] **Step 3: roteamento.** Em `drawSpriteEntity`, no início (após culling? não — antes, pois o segmentado faz o próprio culling), rotear segmentados. Substituir o corpo atual de `drawSpriteEntity` por:
```ts
  private drawSpriteEntity(e: Entity, scrollX: number, entityTint: number): void {
    const typeId = e.tags[0] ?? '';
    const seg = segmentFramesFor(typeId);
    if (seg !== null) { this.drawSegmentedEntity(e, seg, scrollX, entityTint); return; }
    const x = e.transform.position.x;
    if (!isHorizontallyVisible(x, leftExtent(e.hitbox), rightExtent(e.hitbox), scrollX, VIEW_WIDTH, CULL_MARGIN)) {
      return;
    }
    const frame = frameFor(typeId);
    if (frame === null) { // fallback primitivo (id desconhecido)
      this.drawEntity(this.gfx, e);
      return;
    }
    const img = this.acquireSprite();
    img.setTexture(this.atlasKey, frame);
    img.setTint(entityTint);
    const s = this.sizeFor(typeId, e.hitbox);
    img.setDisplaySize(this.px(s.w), this.px(s.h));
    img.setPosition(this.px(x), this.px(e.transform.position.y));
  }
```

- [ ] **Step 4: composição.** Adicionar os métodos (após `drawSpriteEntity`):
```ts
  /** Dims (largura da parte + alturas cap/body/base) do atlas, cacheadas por atlas+body. */
  private segDims(frames: SegmentFrames): { partW: number; capH: number; bodyH: number; baseH: number } {
    const key = this.atlasKey + '|' + frames.body;
    let d = this.segDimCache.get(key);
    if (d === undefined) {
      const tex = this.textures.get(this.atlasKey);
      const cf = tex.get(frames.cap), bf = tex.get(frames.body), sf = tex.get(frames.base);
      d = { partW: bf.width, capH: cf.height, bodyH: bf.height, baseH: sf.height };
      this.segDimCache.set(key, d);
    }
    return d;
  }

  /** Monta cap(topo)+N×body+base(fundo) cobrindo a hitbox aabb (REGRA 2). Alocação-zero:
   *  scratch de layout reusado + pool de Image (REGRA 3). */
  private drawSegmentedEntity(e: Entity, frames: SegmentFrames, scrollX: number, tint: number): void {
    const hb = e.hitbox;
    if (hb.kind !== 'aabb') return; // segmentação só p/ aabb (garantido pelo catálogo)
    const x = e.transform.position.x;
    if (!isHorizontallyVisible(x, leftExtent(hb), rightExtent(hb), scrollX, VIEW_WIDTH, CULL_MARGIN)) return;
    const W = hb.halfW * 2, H = hb.halfH * 2;
    const cy = e.transform.position.y, top = cy - hb.halfH, bottom = cy + hb.halfH;
    const d = this.segDims(frames);
    const widthScale = W / d.partW;
    const L = layoutSegments(H, d.capH * widthScale, d.bodyH * widthScale, d.baseH * widthScale, this.segScratch);
    this.placeSeg(frames.cap, x, top + L.capH / 2, W, L.capH, tint);
    let y = top + L.capH;
    for (let i = 0; i < L.bodyN; i++) {
      this.placeSeg(frames.body, x, y + L.bodyH / 2, W, L.bodyH, tint);
      y += L.bodyH;
    }
    this.placeSeg(frames.base, x, bottom - L.baseH / 2, W, L.baseH, tint);
  }

  /** Posiciona 1 Image do pool numa faixa (cx,cy centro; w×h em unidades de mundo). */
  private placeSeg(frame: string, cx: number, cy: number, w: number, h: number, tint: number): void {
    const img = this.acquireSprite();
    img.setTexture(this.atlasKey, frame);
    img.setTint(tint);
    img.setDisplaySize(this.px(w), this.px(h));
    img.setPosition(this.px(cx), this.px(cy));
  }
```

- [ ] **Step 5: check + testes.** `npm run check` limpo; `npm test` verde (nenhum teste de unidade renderiza a GameScene; guardas anteriores seguem passando).

- [ ] **Step 6: docs.** Em `docs/assets/specs/obstacle.tree.md` e `obstacle.vine.md`, no bloco "Especificação técnica", trocar a linha de Animação/adicionar:
```
- **Composição:** SEGMENTADO (9.2) — 3 frames `cap`/`body`/`base` (tira horizontal); o render monta `cap + N×body + base` para cobrir qualquer altura da hitbox aabb sem distorção. `body` é tileável na vertical. Fonte placeholder: `public/art/themes/<tema>/obstacles/<tema>_<id>.segments.png`. Arte AAA real: prompts A.2 do PHASE-09.
```
Em `docs/assets/asset-registry.md`, na linha de `obstacle.tree`/`obstacle.vine`, anotar `segmentado (cap/body/base)`.

- [ ] **Step 7: validação Playwright.** Build de produção (`npm run build`), servir `dist/`, abrir uma partida; confirmar: obstáculos aabb (tree/vine) altos preenchidos sem vazio/distorção, borda visível coincidindo com a hitbox; stalactite/boulder inalterados; 60fps (p50 ~16,7ms). Registrar evidência. *(Se o ambiente headless não tiver GPU, aceitar a limitação de fps documentada, como em 8.2/9.1.)*

- [ ] **Step 8: commit.**
```bash
git add src/render/GameScene.ts docs/assets/specs/obstacle.tree.md docs/assets/specs/obstacle.vine.md docs/assets/asset-registry.md
git commit -m "feat(render): composição por segmentos cobre a hitbox de tree/vine (9.2)"
```

---

## Self-review
- **Cobertura da spec:** placeholder generator (T2) ✓; gen-atlas parts (T3) ✓; manifesto flag (T1) ✓; helpers puros (T1) ✓; GameScene composição (T4) ✓; guardas de atlas (T3) ✓; docs specs/registry (T4) ✓. Escopo aabb-only ✓.
- **Placeholders:** nenhum TBD/TODO; todo passo tem código concreto.
- **Consistência de tipos:** `SegmentFrames`/`SegmentLayout`/`segmentFramesFor`/`layoutSegments` definidos em T1 e consumidos com as MESMAS assinaturas em T4; `parts`/`ATLAS_SOURCES`/`themeSources` coerentes em T3; `renderSegmentStrip`/`SEG_*` em T2.
- **Determinismo:** core intocado ⇒ 67, sem re-pin (verificar rodando `npm run test:determinism` ao fim).
