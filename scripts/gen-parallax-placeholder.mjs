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
// A amplitude é aplicada pelo chamador (`(profile01(...) - 0.5) * L.amp`).
function profile01(x, theme, layer) {
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
    const top = h - (baseFill + Math.round((profile01(x, theme, layer) - 0.5) * L.amp));
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
