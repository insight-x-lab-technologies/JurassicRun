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

// Rodada A + B. Rodada C estende esta lista (mais grid-slices de sheets entram aqui).
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
    } else if (src.regions) {
      for (const rg of src.regions) {
        const x0 = Math.round(rg.x * img.w), y0 = Math.round(rg.y * img.h);
        const x1 = Math.round((rg.x + rg.w) * img.w), y1 = Math.round((rg.y + rg.h) * img.h);
        const { w, h, pixels } = crop(img, x0, y0, x1, y1, src.maxDim, rg.opaque);
        outs.push({ out: rg.name, png: encodePng(w, h, pixels) });
      }
    } else {
      const { w, h, pixels } = crop(img, 0, 0, img.w, img.h, src.maxDim, src.opaque);
      outs.push({ out: src.out, png: encodePng(w, h, pixels) });
    }
  }
  return outs;
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
