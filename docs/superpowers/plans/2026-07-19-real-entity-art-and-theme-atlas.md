# Arte real de entidades + seam de atlas por tema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o atlas placeholder procedural das 11 entidades in-game por arte real (com dino animado de 6 frames) e adicionar o seam de atlas por tema em `LookPack`.

**Architecture:** O builder `scripts/gen-atlas.mjs` deixa de gerar shapes e passa a **empacotar PNGs reais** de `public/art/final/` (decoder PNG próprio + `encodePng` existente): trim por conteúdo, slice do strip do dino com bbox-união, downscale, shelf-packing, saída JSONHash. `LookPack` ganha `atlas?: AtlasRef`; `GameScene` resolve o atlas do pack ativo no `preload` e anima o dino como `Sprite`.

**Tech Stack:** Node ESM (scripts), Vitest, TypeScript estrito, Phaser (casca render), Preact/signals (packs/tema).

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo permanece **67**; sem re-pin de goldens. (REGRA 1)
- Arte trocável só por dados (manifesto/atlas/pack), nunca por lógica. (REGRA 2)
- Zero alocação por frame no hot path do render. (REGRA 3)
- Sem dep nova nos scripts (só `node:zlib`/`node:fs`/`node:url`/`node:path` + `encodePng`).
- `renderAtlas()` deve continuar **síncrona** e retornar `{ png: Buffer, json }` (contrato do teste).
- Comandos: `npm test` (Vitest), `npm run check` (`tsc --noEmit && eslint .`), `npm run gen:atlas`.
- Commits pequenos; um commit por task. Mensagem termina com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Reescrever o atlas builder para empacotar PNGs reais

**Files:**
- Modify: `scripts/gen-atlas.mjs` (reescrita completa)
- Modify: `scripts/gen-atlas.d.mts` (tipos: `ATLAS_SOURCES`, `renderAtlas`, `ATLAS_KEY`)
- Modify: `tests/render/atlas.test.ts` (reescrita — testa a nova saída)
- Regenera (via `npm run gen:atlas`): `public/atlas/entities.png`, `public/atlas/entities.json`
- Adiciona ao repo (fontes consumidas pelo builder): os 11 PNGs de entidade em `public/art/final/` (ver lista em `ATLAS_SOURCES`).

**Interfaces:**
- Produces: `ATLAS_SOURCES` (array `{id,file,frames}`), `ATLAS_KEY='entities'`, `renderAtlas(): {png:Buffer, json:{frames:Record<string,{frame:{x,y,w,h},rotated,trimmed,sourceSize:{w,h},spriteSourceSize:{x,y,w,h}}>, meta}}`. O JSON contém um frame por id single + `dino.default.0..5` + alias `dino.default`.

- [ ] **Step 1: Escrever o builder novo** — substitui TODO o conteúdo de `scripts/gen-atlas.mjs` por:

```js
// scripts/gen-atlas.mjs
// Empacota os PNGs reais de public/art/final/ num texture atlas (Phaser JSONHash).
// Decoder PNG próprio + encodePng existente — zero dep. Rode `npm run gen:atlas`.
import { encodePng } from './gen-icons.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ART = path.join(ROOT, 'public/art/final');

export const ATLAS_KEY = 'entities';
const CELL_MAX = 128; // maior dimensão de um frame após downscale
const ATLAS_WIDTH = 512; // largura fixa do atlas (shelf packing)
const PAD = 2; // espaçamento entre frames (anti-bleeding)

export const ATLAS_SOURCES = [
  { id: 'dino.default', file: 'dinos/dino.default.flap.png', frames: 6 },
  { id: 'obstacle.tree', file: 'obstacles/obstacle.tree.png', frames: 1 },
  { id: 'obstacle.vine', file: 'obstacles/obstacle.vine.png', frames: 1 },
  { id: 'obstacle.boulder', file: 'obstacles/obstacle.boulder.png', frames: 1 },
  { id: 'obstacle.stalactite', file: 'obstacles/obstacle.stalactite.png', frames: 1 },
  { id: 'bird.coin', file: 'collectibles/bird.coin.png', frames: 1 },
  { id: 'powerup.shield', file: 'powerups/powerup.shield.png', frames: 1 },
  { id: 'powerup.extraLife', file: 'powerups/powerup.extraLife.png', frames: 1 },
  { id: 'powerup.magnet', file: 'powerups/powerup.magnet.png', frames: 1 },
  { id: 'powerup.doubleCoin', file: 'powerups/powerup.doubleCoin.png', frames: 1 },
  { id: 'powerup.slowMo', file: 'powerups/powerup.slowMo.png', frames: 1 },
];

/** Decodifica PNG 8-bit RGBA/RGB não entrelaçado. Retorna {w,h,rgba:Buffer(w*h*4)}. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('não é PNG');
  let off = 8, w, h, bitDepth, colorType, interlace;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`PNG não suportado (bd${bitDepth} il${interlace})`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`colorType ${colorType} não suportado`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels, stride = w * bpp;
  const un = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? un[o + x - bpp] : 0;
      const b = y > 0 ? un[o - stride + x] : 0;
      const c = x >= bpp && y > 0 ? un[o - stride + x - bpp] : 0;
      let v = raw[pos++];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      un[o + x] = v & 255;
    }
  }
  // expande para RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp, d = i * 4;
    if (channels === 4) { rgba[d] = un[s]; rgba[d+1] = un[s+1]; rgba[d+2] = un[s+2]; rgba[d+3] = un[s+3]; }
    else if (channels === 3) { rgba[d] = un[s]; rgba[d+1] = un[s+1]; rgba[d+2] = un[s+2]; rgba[d+3] = 255; }
    else if (channels === 2) { rgba[d] = rgba[d+1] = rgba[d+2] = un[s]; rgba[d+3] = un[s+1]; }
    else { rgba[d] = rgba[d+1] = rgba[d+2] = un[s]; rgba[d+3] = 255; }
  }
  return { w, h, rgba };
}

/** Bounding box do conteúdo com alpha>0 dentro do sub-retângulo [x0,x1)×[y0,y1). */
function contentBounds(img, x0, y0, x1, y1) {
  let minX = x1, minY = y1, maxX = x0, maxY = y0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (img.rgba[(y * img.w + x) * 4 + 3] > 0) {
      if (x < minX) minX = x; if (x + 1 > maxX) maxX = x + 1;
      if (y < minY) minY = y; if (y + 1 > maxY) maxY = y + 1;
    }
  }
  if (maxX <= minX || maxY <= minY) return { minX: x0, minY: y0, maxX: x1, maxY: y1 }; // vazio: usa todo o rect
  return { minX, minY, maxX, maxY };
}

/** Downscale box-average (peso por alpha ⇒ sem halo preto) do sub-rect origem para dw×dh RGBA. */
function cropResize(img, sx, sy, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
    const bx0 = sx + Math.floor((dx * sw) / dw), bx1 = sx + Math.max(Math.floor(((dx + 1) * sw) / dw), Math.floor((dx * sw) / dw) + 1);
    const by0 = sy + Math.floor((dy * sh) / dh), by1 = sy + Math.max(Math.floor(((dy + 1) * sh) / dh), Math.floor((dy * sh) / dh) + 1);
    let sumA = 0, sumR = 0, sumG = 0, sumB = 0, n = 0;
    for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
      const i = (y * img.w + x) * 4, a = img.rgba[i + 3];
      sumR += img.rgba[i] * a; sumG += img.rgba[i + 1] * a; sumB += img.rgba[i + 2] * a; sumA += a; n++;
    }
    const d = (dy * dw + dx) * 4;
    out[d + 3] = Math.round(sumA / n);
    out[d] = sumA > 0 ? Math.round(sumR / sumA) : 0;
    out[d + 1] = sumA > 0 ? Math.round(sumG / sumA) : 0;
    out[d + 2] = sumA > 0 ? Math.round(sumB / sumA) : 0;
  }
  return out;
}

function targetSize(sw, sh) {
  const s = Math.min(1, CELL_MAX / Math.max(sw, sh));
  return { dw: Math.max(1, Math.round(sw * s)), dh: Math.max(1, Math.round(sh * s)) };
}

export function renderAtlas() {
  // 1. Monta os frames recortados/redimensionados: {name, dw, dh, pixels}.
  const frames = [];
  for (const src of ATLAS_SOURCES) {
    const img = decodePng(readFileSync(path.join(ART, src.file)));
    if (src.frames === 1) {
      const b = contentBounds(img, 0, 0, img.w, img.h);
      const sw = b.maxX - b.minX, sh = b.maxY - b.minY, { dw, dh } = targetSize(sw, sh);
      frames.push({ name: src.id, dw, dh, pixels: cropResize(img, b.minX, b.minY, sw, sh, dw, dh) });
    } else {
      const fw = Math.floor(img.w / src.frames);
      // bbox-união em coords relativas à fatia ⇒ registro estável entre frames.
      let uMinX = fw, uMinY = img.h, uMaxX = 0, uMaxY = 0;
      for (let i = 0; i < src.frames; i++) {
        const b = contentBounds(img, i * fw, 0, i * fw + fw, img.h);
        uMinX = Math.min(uMinX, b.minX - i * fw); uMaxX = Math.max(uMaxX, b.maxX - i * fw);
        uMinY = Math.min(uMinY, b.minY); uMaxY = Math.max(uMaxY, b.maxY);
      }
      const sw = uMaxX - uMinX, sh = uMaxY - uMinY, { dw, dh } = targetSize(sw, sh);
      for (let i = 0; i < src.frames; i++) {
        frames.push({ name: `${src.id}.${i}`, dw, dh, pixels: cropResize(img, i * fw + uMinX, uMinY, sw, sh, dw, dh) });
      }
    }
  }
  // 2. Shelf-packing em largura fixa.
  let x = PAD, y = PAD, shelfH = 0, atlasH = 0;
  const placed = [];
  for (const f of frames) {
    if (x + f.dw + PAD > ATLAS_WIDTH) { y += shelfH + PAD; x = PAD; shelfH = 0; }
    placed.push({ ...f, x, y });
    x += f.dw + PAD; if (f.dh > shelfH) shelfH = f.dh; if (y + shelfH + PAD > atlasH) atlasH = y + shelfH + PAD;
  }
  // 3. Blit no buffer do atlas.
  const rgba = Buffer.alloc(ATLAS_WIDTH * atlasH * 4);
  for (const p of placed) for (let ry = 0; ry < p.dh; ry++) {
    p.pixels.copy(rgba, ((p.y + ry) * ATLAS_WIDTH + p.x) * 4, ry * p.dw * 4, (ry * p.dw + p.dw) * 4);
  }
  const png = encodePng(ATLAS_WIDTH, atlasH, rgba);
  // 4. JSON JSONHash + alias dino.default = dino.default.0.
  const jf = {};
  for (const p of placed) {
    jf[p.name] = { frame: { x: p.x, y: p.y, w: p.dw, h: p.dh }, rotated: false, trimmed: false, sourceSize: { w: p.dw, h: p.dh }, spriteSourceSize: { x: 0, y: 0, w: p.dw, h: p.dh } };
  }
  jf['dino.default'] = { ...jf['dino.default.0'] };
  const json = { frames: jf, meta: { image: 'entities.png', size: { w: ATLAS_WIDTH, h: atlasH }, scale: '1' } };
  return { png, json };
}

function main() {
  const dir = path.join(ROOT, 'public/atlas');
  mkdirSync(dir, { recursive: true });
  const { png, json } = renderAtlas();
  writeFileSync(path.join(dir, 'entities.png'), png);
  writeFileSync(path.join(dir, 'entities.json'), JSON.stringify(json, null, 2));
  console.log(`atlas: ${png.length} bytes, ${Object.keys(json.frames).length} frames`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 2: Atualizar os tipos** — substitui TODO o conteúdo de `scripts/gen-atlas.d.mts` por:

```ts
export const ATLAS_KEY: string;
export const ATLAS_SOURCES: readonly { id: string; file: string; frames: number }[];
export function renderAtlas(): {
  png: Buffer;
  json: {
    frames: Record<string, {
      frame: { x: number; y: number; w: number; h: number };
      rotated: boolean; trimmed: boolean;
      sourceSize: { w: number; h: number };
      spriteSourceSize: { x: number; y: number; w: number; h: number };
    }>;
    meta: Record<string, unknown>;
  };
};
```

- [ ] **Step 3: Reescrever o teste** — substitui TODO o conteúdo de `tests/render/atlas.test.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ATLAS_SOURCES, renderAtlas } from '../../scripts/gen-atlas.mjs';
import { ASSET_MANIFEST } from '@render/manifest';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('atlas de entidades (arte real)', () => {
  it('renderAtlas gera PNG com assinatura + IHDR válidos', () => {
    const { png } = renderAtlas();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  });

  it('encoder é determinístico (mesmos bytes a cada run)', () => {
    expect(renderAtlas().png.equals(renderAtlas().png)).toBe(true);
  });

  it('COMPLETUDE: todo id sprite do manifesto tem frame no atlas', () => {
    const { json } = renderAtlas();
    for (const [id, r] of Object.entries(ASSET_MANIFEST)) {
      if (r.kind === 'sprite') {
        expect(json.frames[id], `manifesto sprite sem frame: ${id}`).toBeDefined();
      }
    }
  });

  it('o dino tem 6 frames de flap + alias, cada um com geometria válida', () => {
    const { json } = renderAtlas();
    for (let i = 0; i < 6; i++) expect(json.frames[`dino.default.${i}`], `frame ${i}`).toBeDefined();
    expect(json.frames['dino.default']).toEqual(json.frames['dino.default.0']);
    for (const f of Object.values(json.frames)) {
      expect(f.frame.w).toBeGreaterThan(0);
      expect(f.frame.h).toBeGreaterThan(0);
    }
  });

  it('sem frame órfão: todo id (sem sufixo .N de animação) existe no manifesto', () => {
    const { json } = renderAtlas();
    for (const name of Object.keys(json.frames)) {
      const base = name.replace(/\.\d+$/, '');
      expect(ASSET_MANIFEST[base], `frame órfão: ${name}`).toBeDefined();
    }
  });

  it('os arquivos commitados existem e o PNG bate com o gerado', () => {
    const png = readFileSync(path.join(root, 'public/atlas/entities.png'));
    expect(png.equals(renderAtlas().png)).toBe(true);
  });
});
```

- [ ] **Step 4: Rodar o teste — deve FALHAR** (builder antigo/atlas antigo)

Run: `npx vitest run tests/render/atlas.test.ts`
Expected: FAIL (ex.: `dino.default.0` ausente; PNG commitado não bate).

- [ ] **Step 5: Regenerar o atlas commitado**

Run: `npm run gen:atlas`
Expected: imprime `atlas: <N> bytes, 18 frames` (11 singles + 6 dino + 1 alias = 18) e reescreve `public/atlas/entities.{png,json}`.

- [ ] **Step 6: Rodar o teste — deve PASSAR**

Run: `npx vitest run tests/render/atlas.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 7: Commit**

```bash
git add scripts/gen-atlas.mjs scripts/gen-atlas.d.mts tests/render/atlas.test.ts public/atlas/entities.png public/atlas/entities.json \
  public/art/final/dinos/dino.default.flap.png \
  public/art/final/obstacles/obstacle.tree.png public/art/final/obstacles/obstacle.vine.png \
  public/art/final/obstacles/obstacle.boulder.png public/art/final/obstacles/obstacle.stalactite.png \
  public/art/final/collectibles/bird.coin.png \
  public/art/final/powerups/powerup.shield.png public/art/final/powerups/powerup.extraLife.png \
  public/art/final/powerups/powerup.magnet.png public/art/final/powerups/powerup.doubleCoin.png \
  public/art/final/powerups/powerup.slowMo.png
git commit -m "feat(8.1): atlas builder empacota PNGs reais de entidade (dino 6-frame flap)"
```

---

### Task 2: Seam de atlas por tema em LookPack + sprites

**Files:**
- Modify: `src/render/sprites.ts` (adiciona `AtlasRef`, `DEFAULT_ATLAS`, `atlasRefFor`; `ATLAS_*` derivam de `DEFAULT_ATLAS`)
- Modify: `src/render/packs.ts` (campo `atlas?` em `LookPack`; `PACK_CLASSIC.atlas` definido)
- Modify: `tests/render/sprites.test.ts` (adiciona testes de `atlasRefFor`/`DEFAULT_ATLAS`)
- Create: `tests/render/packs.test.ts` (atlas do classic definido; volcano/glacier sem atlas próprio)

**Interfaces:**
- Consumes: `renderableFor` (manifest), `LookPack`/`packForId`/`PACK_CLASSIC` (packs).
- Produces: `type AtlasRef = { key: string; png: string; json: string }`; `DEFAULT_ATLAS: AtlasRef`; `atlasRefFor(pack: { atlas?: AtlasRef }): AtlasRef`; `LookPack.atlas?: AtlasRef`. `ATLAS_KEY/ATLAS_PNG/ATLAS_JSON` seguem exportados (= campos de `DEFAULT_ATLAS`).

- [ ] **Step 1: Escrever os testes que falham** — adiciona a `tests/render/sprites.test.ts` (dentro de um novo `describe`):

```ts
import { atlasRefFor, DEFAULT_ATLAS } from '@render/sprites';
import { PACK_CLASSIC, packForId } from '@render/packs';

describe('seam de atlas por tema', () => {
  it('DEFAULT_ATLAS aponta para o atlas de entidades', () => {
    expect(DEFAULT_ATLAS).toEqual({ key: 'entities', png: 'atlas/entities.png', json: 'atlas/entities.json' });
  });
  it('atlasRefFor: classic usa seu próprio atlas', () => {
    expect(atlasRefFor(PACK_CLASSIC)).toEqual(DEFAULT_ATLAS);
  });
  it('atlasRefFor: pack sem atlas cai no default', () => {
    expect(atlasRefFor(packForId('volcano'))).toEqual(DEFAULT_ATLAS);
    expect(atlasRefFor(packForId('glacier'))).toEqual(DEFAULT_ATLAS);
  });
});
```

E cria `tests/render/packs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PACK_CLASSIC, packForId } from '@render/packs';
import { DEFAULT_ATLAS } from '@render/sprites';

describe('packs look&feel', () => {
  it('classic carrega o atlas real (tema default)', () => {
    expect(PACK_CLASSIC.atlas).toEqual(DEFAULT_ATLAS);
  });
  it('volcano/glacier não definem atlas próprio (reusam o default)', () => {
    expect(packForId('volcano').atlas).toBeUndefined();
    expect(packForId('glacier').atlas).toBeUndefined();
  });
  it('packForId cai em classic para id desconhecido', () => {
    expect(packForId('nao.existe').id).toBe('classic');
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run tests/render/sprites.test.ts tests/render/packs.test.ts`
Expected: FAIL (`atlasRefFor`/`DEFAULT_ATLAS`/`PACK_CLASSIC.atlas` não existem).

- [ ] **Step 3: Implementar em `src/render/sprites.ts`** — substitui as 3 constantes de topo (linhas 4-6) por:

```ts
export type AtlasRef = { readonly key: string; readonly png: string; readonly json: string };

/** Atlas de entidades default (tema classic). Paths relativos ao BASE_URL. */
export const DEFAULT_ATLAS: AtlasRef = { key: 'entities', png: 'atlas/entities.png', json: 'atlas/entities.json' };

/** Atlas ativo = o do pack, senão o default. Seam para sets de arte por tema. */
export function atlasRefFor(pack: { readonly atlas?: AtlasRef }): AtlasRef {
  return pack.atlas ?? DEFAULT_ATLAS;
}

export const ATLAS_KEY = DEFAULT_ATLAS.key;
export const ATLAS_PNG = DEFAULT_ATLAS.png;
export const ATLAS_JSON = DEFAULT_ATLAS.json;
```

- [ ] **Step 4: Implementar em `src/render/packs.ts`** — importa o tipo e adiciona o campo:

No topo, junto dos imports existentes:
```ts
import { DEFAULT_ATLAS, type AtlasRef } from './sprites';
```
Na interface `LookPack`, adiciona:
```ts
  /** Atlas de entidades do tema; ausente ⇒ reusa o default (seam para arte alternativa, 8.1). */
  readonly atlas?: AtlasRef;
```
Em `PACK_CLASSIC`, adiciona a propriedade:
```ts
  atlas: DEFAULT_ATLAS,
```
(volcano/glacier permanecem SEM `atlas`.)

- [ ] **Step 5: Rodar — deve PASSAR + suíte inteira**

Run: `npx vitest run tests/render/sprites.test.ts tests/render/packs.test.ts && npm run check`
Expected: PASS; `tsc`/eslint limpos. (Cuidado: `packs.ts` importar de `sprites.ts` não cria ciclo — `sprites.ts` não importa `packs.ts`.)

- [ ] **Step 6: Commit**

```bash
git add src/render/sprites.ts src/render/packs.ts tests/render/sprites.test.ts tests/render/packs.test.ts
git commit -m "feat(8.1): seam de atlas por tema (LookPack.atlas + atlasRefFor)"
```

---

### Task 3: GameScene — carregar atlas do pack ativo + animar o dino

**Files:**
- Modify: `src/render/GameScene.ts` (preload resolve atlas do pack; `dinoSprite` vira `Sprite` animado)
- Modify: `src/render/constants.ts` (adiciona `DINO_FLAP_FPS`)

**Interfaces:**
- Consumes: `atlasRefFor` (sprites), `packForId` + `entitlementsService.activeExpansion` (pack ativo), frames `dino.default.0..5` do atlas (Task 1).
- Produces: nenhuma API nova (casca Phaser; sem teste de unidade — validado no Playwright da Task 5).

- [ ] **Step 1: Adicionar a constante** — em `src/render/constants.ts`, adiciona:

```ts
/** Frames por segundo da animação de flap do dino (8.1). */
export const DINO_FLAP_FPS = 12;
```

- [ ] **Step 2: `preload` lê o atlas do pack ativo** — em `src/render/GameScene.ts`, substitui o corpo de `preload()` (linhas 77-80):

```ts
  preload(): void {
    const base = import.meta.env.BASE_URL; // termina com '/'
    const ref = atlasRefFor(packForId(entitlementsService.activeExpansion.value.id));
    this.load.atlas(ref.key, base + ref.png, base + ref.json);
  }
```
E no import de `./sprites` (linha 10), adiciona `atlasRefFor`:
```ts
import { ATLAS_KEY, spriteSizeFor, frameFor, atlasRefFor } from './sprites';
```
(`ATLAS_PNG`/`ATLAS_JSON` deixam de ser usados aqui — remova-os do import se o eslint `no-unused-vars` reclamar; continuam exportados por `sprites.ts`.)

- [ ] **Step 3: `dinoSprite` vira `Sprite` animado** — três edições:

(a) Campo (linha 68): troca o tipo
```ts
  private dinoSprite!: Phaser.GameObjects.Sprite;
```
(b) Import da constante — adiciona `DINO_FLAP_FPS` ao bloco de import de `./constants`.
(c) Em `create()`, substitui a criação do dino (linha 109) por:
```ts
    // Dino (8.1): Sprite animado (flap de 6 frames do atlas). frameFor resolve o alias
    // `dino.default` como textura inicial; a anim cicla dino.default.0..5.
    this.dinoSprite = this.add
      .sprite(0, 0, ATLAS_KEY, frameFor(DINO_TYPE_ID) ?? DINO_TYPE_ID)
      .setDepth(1);
    if (!this.anims.exists('dino.flap')) {
      this.anims.create({
        key: 'dino.flap',
        frames: this.anims.generateFrameNames(ATLAS_KEY, { prefix: 'dino.default.', start: 0, end: 5 }),
        frameRate: DINO_FLAP_FPS,
        repeat: -1,
      });
    }
    this.dinoSprite.play('dino.flap');
```
(O bloco de `update()` que faz `setPosition/setTint/setDisplaySize/setVisible` no `dinoSprite` continua idêntico — `Sprite ⊂ Image`.)

- [ ] **Step 4: Verificar tipos e suíte**

Run: `npm run check && npm test`
Expected: `tsc`/eslint limpos; **todos os testes verdes** (nada de novo quebrou; GameScene não tem teste de unidade). Determinismo intocado.

- [ ] **Step 5: Commit**

```bash
git add src/render/GameScene.ts src/render/constants.ts
git commit -m "feat(8.1): GameScene carrega atlas do pack ativo + anima o dino (flap 6f)"
```

---

### Task 4: Registro de assets vira status `art` + guarda de fonte

**Files:**
- Modify: `docs/assets/asset-registry.md` (status dos 11 ids in-game: `spec` → `art`)
- Modify: `tests/assets/registry-specs.test.ts` (guarda: ids `art` têm PNG-fonte em `public/art/final/`)

**Interfaces:**
- Consumes: `ATLAS_SOURCES` (Task 1) — a lista canônica id↔arquivo-fonte.
- Produces: nenhuma API.

- [ ] **Step 1: Escrever a guarda que falha** — adiciona a `tests/assets/registry-specs.test.ts`:

```ts
import { ATLAS_SOURCES } from '../../scripts/gen-atlas.mjs';

describe('entidades in-game: arte real presente', () => {
  it('todo id de ATLAS_SOURCES tem o PNG-fonte em public/art/final/', () => {
    const missing = ATLAS_SOURCES.filter(
      (s) => !existsSync(join(ROOT, 'public/art/final', s.file)),
    );
    expect(missing).toEqual([]);
  });

  it('o registro marca as 11 entidades in-game como `art`', () => {
    const md = readFileSync(REGISTRY, 'utf8');
    for (const s of ATLAS_SOURCES) {
      const row = md.split('\n').find((l) => l.includes(`\`${s.id}\``));
      expect(row, `sem linha no registro: ${s.id}`).toBeDefined();
      expect(row, `${s.id} não está \`art\``).toMatch(/\bart\b/);
    }
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run tests/assets/registry-specs.test.ts`
Expected: FAIL (as linhas ainda dizem `placeholder`/`spec`).

- [ ] **Step 3: Atualizar o registro** — em `docs/assets/asset-registry.md`, troca a coluna `status` de `placeholder`/`spec` para `art` **apenas** nas 11 linhas: `dino.default`, `obstacle.tree`, `obstacle.vine`, `obstacle.boulder`, `obstacle.stalactite`, `bird.coin`, `powerup.shield`, `powerup.extraLife`, `powerup.magnet`, `powerup.doubleCoin`, `powerup.slowMo`. (NÃO mexer nos outros — Tier 1 e os 10 dinos do Ninho seguem `spec`.)

- [ ] **Step 4: Rodar — deve PASSAR + suíte inteira**

Run: `npx vitest run tests/assets/registry-specs.test.ts && npm test && npm run check`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add docs/assets/asset-registry.md tests/assets/registry-specs.test.ts
git commit -m "docs(8.1): 11 entidades in-game viram status `art` + guarda de fonte"
```

---

### Task 5 (controlador, inline): validação visual + docs de estado

Não é subagente — usa Playwright MCP e edita docs de estado do projeto.

- [ ] **Step 1:** Rodar `npm run build` e servir o `dist/` (ou `npm run dev`); abrir no Playwright (mobile emulado 390×844). Iniciar partida (tap), observar: entidades reais renderizando (dino/obstáculos/moeda/power-ups), **o dino flapeja** (anim ciclando), sem fundo preto espúrio.
- [ ] **Step 2:** Medir fps por ~8s de partida (rAF): confirmar p50 ~16,7ms / 60fps e ausência de jank; contar draw calls (esperado baixo — 1 textura de atlas ⇒ batching).
- [ ] **Step 3:** Registrar evidência. Atualizar `docs/roadmap/PHASE-08-art-and-packs.md` (8.1: parte in-game concluída) e o bloco **Estado atual** de `CLAUDE.md`.
- [ ] **Step 4:** Commit das docs de estado.

**Nota de cache do SW (gotcha 7.2/8.3):** o service worker pode servir `dist/` antigo. Se a arte não trocar no browser: `unregister()` do SW + limpar caches + navegar com `?nocache=<ts>`.

## Self-Review

- **Cobertura do spec:** builder de PNGs reais (T1) ✓; dino animado 6f (T1 atlas + T3 anim) ✓; seam `LookPack.atlas`/`atlasRefFor` (T2) ✓; GameScene carrega atlas do pack + anima (T3) ✓; registro `art` + guarda (T4) ✓; validação 60fps/visual (T5) ✓; determinismo intocado (core não tocado em nenhuma task) ✓.
- **Placeholders:** nenhum — todo passo traz código/comando/expected reais.
- **Consistência de tipos:** `AtlasRef{key,png,json}` definido em T2 e consumido por `atlasRefFor`/`LookPack.atlas`/GameScene `preload` idêntico; `renderAtlas(){png,json}` mantém o contrato do teste; `ATLAS_SOURCES` exportado em T1 e consumido em T4; frames `dino.default.0..5` gerados em T1 e referenciados por `generateFrameNames(prefix:'dino.default.')` em T3.
- **Fronteiras de task:** cada task tem deliverable testável independente (builder+atlas; seam de dados; casca render; registro/docs); T5 é validação/estado do controlador.
```
