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
