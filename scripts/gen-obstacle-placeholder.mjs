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
