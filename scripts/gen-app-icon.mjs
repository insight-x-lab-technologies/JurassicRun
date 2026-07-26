// scripts/gen-app-icon.mjs
// Ícones da PWA (iOS/Android/favicon) COMPOSTOS a partir da arte real do jogo — substituem o
// placeholder geométrico (fundo sólido + triângulo azul) que aparecia na home screen do iPhone.
// Assunto: a moeda cunhada com o pterodáctilo em relevo (o emblema do jogo desde a Fase 9);
// fundo: gradiente radial escuro dos design tokens + aro dourado. Zero dep: reusa o encoder de
// gen-icons e o decoder/chroma/resize de gen-atlas. Rode `npm run gen:icons`.
import { encodePng } from './gen-icons.mjs';
import { loadArt, chromaKeyToAlpha, contentBounds, cropResize } from './gen-atlas.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Arte-fonte do assunto: moeda do tema classic (chroma verde). */
const SUBJECT = {
  file: 'collectibles/classic_bird.coin.chromakey.png',
  root: 'public/art/themes/classic',
};

// Paleta: tokens do jogo (src/app/styles/tokens.css).
const BG_CENTER = [0x1c, 0x24, 0x33]; // azul-noite levemente iluminado no centro
const BG_EDGE = [0x0a, 0x0c, 0x10]; // quase --color-bg, escurecido nas bordas
const GOLD = [0xc9, 0xa2, 0x27]; // --color-gold

/**
 * Fração do lado ocupada pelo assunto.
 *
 * `maskable` precisa caber na safe-zone de ~80% central (o SO recorta círculo/squircle), então o
 * assunto encolhe E o aro dourado some — um aro na borda seria a primeira coisa cortada.
 */
const SUBJECT_SCALE = { any: 0.74, maskable: 0.56 };

/** Anel dourado: raio (fração do lado) e espessura em px por 512 de lado. */
const RIM_RADIUS = 0.468;
const RIM_WIDTH_AT_512 = 6;

/** Assunto decodificado, com alpha e recortado na bbox de conteúdo. Memoizado por `loadArt`. */
function subjectRgba() {
  const img = chromaKeyToAlpha(loadArt(SUBJECT.file, SUBJECT.root));
  const b = contentBounds(img, 0, 0, img.w, img.h);
  return { img, sx: b.minX, sy: b.minY, sw: b.maxX - b.minX, sh: b.maxY - b.minY };
}

/**
 * Ícone `size`×`size` RGBA OPACO (ícone de SO não pode vazar o fundo do sistema).
 * @param {number} size @param {{maskable?: boolean}} [opts] @returns {Buffer}
 */
export function renderAppIcon(size, opts = {}) {
  const maskable = opts.maskable === true;
  const rgba = Buffer.alloc(size * size * 4);

  // 1. Fundo: gradiente radial center→edge, com o canto = 100% da cor de borda.
  const c = (size - 1) / 2;
  const maxR = Math.hypot(c, c);
  const rim = maskable ? -1 : RIM_RADIUS * size;
  const rimHalf = (RIM_WIDTH_AT_512 * size) / 512 / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const t = Math.min(1, d / maxR);
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(BG_CENTER[k] + (BG_EDGE[k] - BG_CENTER[k]) * t);
      rgba[i + 3] = 0xff;
      // aro dourado (anti-aliasing por distância à circunferência)
      if (rim > 0) {
        const e = Math.abs(d - rim);
        if (e <= rimHalf + 1) {
          const a = Math.max(0, Math.min(1, rimHalf + 0.5 - e));
          for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(rgba[i + k] + (GOLD[k] - rgba[i + k]) * a);
        }
      }
    }
  }

  // 2. Assunto centrado, composto sobre o fundo (alpha over).
  const { img, sx, sy, sw, sh } = subjectRgba();
  const target = Math.round(size * (maskable ? SUBJECT_SCALE.maskable : SUBJECT_SCALE.any));
  const dw = sw >= sh ? target : Math.max(1, Math.round((sw / sh) * target));
  const dh = sh >= sw ? target : Math.max(1, Math.round((sh / sw) * target));
  const px = cropResize(img, sx, sy, sw, sh, dw, dh);
  const ox = Math.round((size - dw) / 2);
  const oy = Math.round((size - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const s = (y * dw + x) * 4;
      const a = px[s + 3] / 255;
      if (a === 0) continue;
      const d = ((oy + y) * size + ox + x) * 4;
      for (let k = 0; k < 3; k++) rgba[d + k] = Math.round(px[s + k] * a + rgba[d + k] * (1 - a));
      rgba[d + 3] = 0xff;
    }
  }
  return rgba;
}

/** Nome → parâmetros. `icon-180` é o `apple-touch-icon` (iOS ignora maskable e não recorta). */
export const APP_ICONS = [
  { name: 'icon-180.png', size: 180, maskable: false },
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

function main() {
  const dir = path.join(ROOT, 'public/icons');
  mkdirSync(dir, { recursive: true });
  for (const { name, size, maskable } of APP_ICONS) {
    const png = encodePng(size, size, renderAppIcon(size, { maskable }));
    writeFileSync(path.join(dir, name), png);
    console.log(`escrito public/icons/${name} (${png.length} bytes)`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
