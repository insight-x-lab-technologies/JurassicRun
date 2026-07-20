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

// Variantes de atlas (multi-atlas). Um atlas de tema entra aqui: { key, sources } com os MESMOS
// ids do manifesto e arquivos-fonte diferentes; depois `npm run gen:atlas` + `pack.atlas`.
export const ATLAS_VARIANTS = [{ key: ATLAS_KEY, sources: ATLAS_SOURCES }];

/** Decodifica PNG 8-bit RGBA/RGB não entrelaçado. Retorna {w,h,rgba:Buffer(w*h*4)}. */
export function decodePng(buf) {
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
export function contentBounds(img, x0, y0, x1, y1) {
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
export function cropResize(img, sx, sy, sw, sh, dw, dh) {
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

export function renderAtlas(sources = ATLAS_SOURCES) {
  // 1. Monta os frames recortados/redimensionados: {name, dw, dh, pixels}.
  const frames = [];
  for (const src of sources) {
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
  if (jf['dino.default.0']) jf['dino.default'] = { ...jf['dino.default.0'] };
  const json = { frames: jf, meta: { image: 'entities.png', size: { w: ATLAS_WIDTH, h: atlasH }, scale: '1' } };
  return { png, json };
}

function main() {
  const dir = path.join(ROOT, 'public/atlas');
  mkdirSync(dir, { recursive: true });
  for (const v of ATLAS_VARIANTS) {
    const { png, json } = renderAtlas(v.sources);
    json.meta.image = `${v.key}.png`; // por variante (byte-idêntico p/ 'entities')
    writeFileSync(path.join(dir, `${v.key}.png`), png);
    writeFileSync(path.join(dir, `${v.key}.json`), JSON.stringify(json, null, 2));
    console.log(`atlas ${v.key}: ${png.length} bytes, ${Object.keys(json.frames).length} frames`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
