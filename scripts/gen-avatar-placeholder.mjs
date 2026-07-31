// scripts/gen-avatar-placeholder.mjs
// PLACEHOLDER dos 12 avatares de perfil (10.6). Medalhão: fundo radial dos tokens + aro dourado +
// o pterodáctilo REAL de public/ui/dino.starter.png com rotação de matiz por índice. A arte AAA
// definitiva chega como folha 4×3 (ver docs/assets/specs/ui.avatars.md) e entra pelo gen-ui.mjs.
// Zero dep. Rode `npm run gen:avatars`.
import { encodePng } from './gen-icons.mjs';
import { loadArt, contentBounds, cropResize } from './gen-atlas.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SIZE = 128;
const SUBJECT = { file: 'dino.starter.png', root: 'public/ui' };
const RIM = [0xc9, 0xa2, 0x27]; // --color-gold
const AVATAR_IDS = ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12'];

/** HSL→RGB (h em graus, s/l em 0..1). */
function hsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Assunto decodificado e recortado na bbox de conteúdo (memoizado por loadArt). */
function subject() {
  const img = loadArt(SUBJECT.file, SUBJECT.root);
  const b = contentBounds(img, 0, 0, img.w, img.h);
  return { img, sx: b.minX, sy: b.minY, sw: b.maxX - b.minX, sh: b.maxY - b.minY };
}

/** Medalhão RGBA `size`×`size`: disco colorido, aro dourado, silhueta do dino tingida. */
export function renderAvatar(size, hue) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const radius = size * 0.48;
  const rimHalf = size * 0.022;
  const inner = hsl(hue, 0.5, 0.42);
  const outer = hsl(hue, 0.55, 0.22);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const i = (y * size + x) * 4;
      if (d > radius + rimHalf) { rgba[i + 3] = 0; continue; }
      const t = Math.min(1, d / radius);
      for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(inner[k] + (outer[k] - inner[k]) * t);
      rgba[i + 3] = 255;
      const e = Math.abs(d - radius);
      if (e <= rimHalf + 1) {
        const a = Math.max(0, Math.min(1, rimHalf + 0.5 - e));
        for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(rgba[i + k] + (RIM[k] - rgba[i + k]) * a);
      }
      // borda externa do disco: anti-aliasing do alpha
      if (d > radius + rimHalf - 1) rgba[i + 3] = Math.round(255 * Math.max(0, radius + rimHalf - d));
    }
  }
  // Assunto centrado, tingido pelo matiz (mistura 45% com o cinza do próprio pixel).
  const { img, sx, sy, sw, sh } = subject();
  const target = Math.round(size * 0.62);
  const dw = sw >= sh ? target : Math.max(1, Math.round((sw / sh) * target));
  const dh = sh >= sw ? target : Math.max(1, Math.round((sh / sw) * target));
  const px = cropResize(img, sx, sy, sw, sh, dw, dh);
  const tint = hsl(hue, 0.65, 0.72);
  const ox = Math.round((size - dw) / 2);
  const oy = Math.round((size - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const s = (y * dw + x) * 4;
      const a = px[s + 3] / 255;
      if (a === 0) continue;
      const d = ((oy + y) * size + ox + x) * 4;
      for (let k = 0; k < 3; k++) {
        const src = Math.round(px[s + k] * 0.55 + tint[k] * 0.45);
        rgba[d + k] = Math.round(src * a + rgba[d + k] * (1 - a));
      }
      rgba[d + 3] = Math.max(rgba[d + 3], Math.round(a * 255));
    }
  }
  return rgba;
}

function main() {
  const force = process.argv.includes('--force');
  const dir = path.join(ROOT, 'public/ui');
  mkdirSync(dir, { recursive: true });
  AVATAR_IDS.forEach((id, i) => {
    const file = path.join(dir, `avatar.${id}.png`);
    // NÃO sobrescreve arte existente sem --force: o gotcha da Fase 9 foi um gerador de
    // placeholder apagando a arte real ao rodar de novo.
    if (existsSync(file) && !force) { console.log(`pulado ${id} (já existe)`); return; }
    const png = encodePng(SIZE, SIZE, renderAvatar(SIZE, i * 30));
    writeFileSync(file, png);
    console.log(`escrito public/ui/avatar.${id}.png (${png.length} bytes)`);
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
