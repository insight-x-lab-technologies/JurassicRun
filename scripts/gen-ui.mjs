// scripts/gen-ui.mjs
// Processa a arte-fonte Tier-1 (public/art/final) em assets de runtime pequenos (public/ui).
// Reusa o decoder/cropResize de gen-atlas + encodePng. Zero dep. Rode `npm run gen:ui`.
import { encodePng } from './gen-icons.mjs';
import { contentBounds, cropResize, loadArt, chromaKeyToAlpha } from './gen-atlas.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

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
    { name: 'nav.bar', x: 0.03, y: 0.55, w: 0.94, h: 0.14 },
    { name: 'medal.gold', x: 0.03, y: 0.71, w: 0.31, h: 0.27 },
    { name: 'medal.silver', x: 0.34, y: 0.71, w: 0.31, h: 0.27 },
    { name: 'medal.bronze', x: 0.65, y: 0.71, w: 0.31, h: 0.27 } ] },
  { out: 'covers', file: 'expansions/expansion.covers.png', maxDim: 512, regions: [
    { name: 'cover.classic', x: 0.0, y: 0, w: 0.3333, h: 1, opaque: true },
    { name: 'cover.volcano', x: 0.3333, y: 0, w: 0.3333, h: 1, opaque: true },
    { name: 'cover.glacier', x: 0.6667, y: 0, w: 0.3333, h: 1, opaque: true } ] },
  // `padBottomTo`: altura final em px. A base de cada tira é 100% opaca, então replicar a
  // última linha estende a silhueta até o chão como uma "saia" sólida. Sem isso a TileSprite
  // repetia a textura na vertical (o topo transparente da repetição virava um corte reto no
  // meio do céu) e a camada `near` era cortada embaixo. Ver PARALLAX_LAYERS em constants.
  { out: 'parallax', file: 'parallax/bg.layers.png', maxDim: 2172, regions: [
    { name: 'parallax.far', x: 0, y: 0.0, w: 1, h: 0.34, padBottomTo: 350 },
    { name: 'parallax.mid', x: 0, y: 0.34, w: 1, h: 0.34, padBottomTo: 235 },
    { name: 'parallax.near', x: 0, y: 0.66, w: 1, h: 0.34 } ] },
  // Parallax FOTORREALISTA por tema (Task 5, substitui `parallax.*` acima para packs volcano/
  // glacier/classic no runtime — os 3 arquivos sem sufixo continuam gerados/commitados pois um
  // teste ainda os referencia, mas nada mais os consome). Cada folha `ui/<tema>_ui-
  // parallax.chromakey.png` (1536×1024) tem uma ilustração grande no topo (não usada) + a banda
  // de 3 sub-camadas no terço inferior. `classic`/`volcano` têm linhas de chroma separando
  // far/mid/near; `glacier` é uma cena contínua sem linha (dividida em terços iguais). Frações
  // calibradas por detecção de chroma-separador + verificação visual (Playwright) por tema.
  // Tiras OPACAS (cena fotorreal completa, não silhueta) — SEM padBottomTo: a base fotorreal não
  // tem linha 100% opaca full-width, então o skirt replicava a franja de chroma como streaks
  // verticais. `chroma:true` + `hardAlpha:true` removem o separador e a franja feather (o chroma
  // default só zera o separador puro; hardAlpha corta o anel semi-transparente e re-apara). No
  // GameScene: bg.screen entra como backdrop de tela cheia e estas tiras ficam por cima (bandas).
  { out: 'parallax.theme.classic', file: 'ui/classic_ui-parallax.chromakey.png',
    root: 'public/art/themes/classic', maxDim: 2172, chroma: true, hardAlpha: true, regions: [
      { name: 'parallax.far.classic', x: 0, y: 0.6377, w: 1, h: 0.0996 },
      { name: 'parallax.mid.classic', x: 0, y: 0.7412, w: 1, h: 0.1113 },
      { name: 'parallax.near.classic', x: 0, y: 0.8574, w: 1, h: 0.1045 } ] },
  { out: 'parallax.theme.volcano', file: 'ui/volcano_ui-parallax.chromakey.png',
    root: 'public/art/themes/volcano', maxDim: 2172, chroma: true, hardAlpha: true, regions: [
      { name: 'parallax.far.volcano', x: 0, y: 0.6689, w: 1, h: 0.0977 },
      { name: 'parallax.mid.volcano', x: 0, y: 0.7764, w: 1, h: 0.0957 },
      { name: 'parallax.near.volcano', x: 0, y: 0.8828, w: 1, h: 0.0900 } ] },
  { out: 'parallax.theme.glacier', file: 'ui/glacier_ui-parallax.chromakey.png',
    root: 'public/art/themes/glacier', maxDim: 2172, chroma: true, hardAlpha: true, regions: [
      { name: 'parallax.far.glacier', x: 0, y: 0.6985, w: 1, h: 0.0899 },
      { name: 'parallax.mid.glacier', x: 0, y: 0.7884, w: 1, h: 0.0960 },
      { name: 'parallax.near.glacier', x: 0, y: 0.8845, w: 1, h: 0.0880 } ] },
  ...['starter', 'lodestone', 'goldbeak', 'midas', 'nine-lives', 'aegis', 'prospector', 'harvester', 'phoenix', 'guardian'].map((id) => ({
    out: `dino.${id}`, file: `dinos/dino.${id}.flap.png`, maxDim: 256,
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

/**
 * Estende a imagem para baixo replicando a última linha SÓLIDA.
 *
 * Replicar literalmente a última linha não serve: o recorte/redimensionamento deixa 1–2 linhas
 * de franja quase transparente no rodapé (o `far` termina com alpha médio 17), e a saia saía
 * como um véu translúcido em vez da silhueta. Procura-se a última linha cheia e a franja abaixo
 * dela é descartada.
 */
function padBottom(w, h, pixels, targetH) {
  const meanAlpha = (y) => {
    let sum = 0;
    for (let x = 0; x < w; x++) sum += pixels[(y * w + x) * 4 + 3];
    return sum / w;
  };
  let src = h - 1;
  for (let y = h - 1; y >= 0; y--) {
    if (meanAlpha(y) >= 250) { src = y; break; }
  }
  const out = Buffer.alloc(w * targetH * 4);
  pixels.copy(out, 0, 0, (src + 1) * w * 4); // descarta a franja abaixo de `src`
  const solid = pixels.subarray(src * w * 4, (src + 1) * w * 4);
  for (let y = src + 1; y < targetH; y++) solid.copy(out, y * w * 4);
  return out;
}

/** Corta a franja feather de tiras opacas: alpha<thresh → 0, depois re-apara a bbox de conteúdo.
 * O chroma default deixa um anel de pixels semi-transparentes (borda do separador) que sobra como
 * franja colorida; tiras fotorreais são opacas no interior, então qualquer alpha<thresh é franja. */
function hardCutAlpha(w, h, pixels, thresh) {
  for (let i = 0; i < w * h; i++) if (pixels[i * 4 + 3] < thresh) pixels[i * 4 + 3] = 0;
  const b = contentBounds({ w, h, rgba: pixels }, 0, 0, w, h);
  const nw = b.maxX - b.minX, nh = b.maxY - b.minY;
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) pixels.copy(out, y * nw * 4, ((b.minY + y) * w + b.minX) * 4, ((b.minY + y) * w + b.minX + nw) * 4);
  return { w: nw, h: nh, pixels: out };
}

export function renderUi() {
  const outs = [];
  for (const src of UI_SOURCES) {
    let img = loadArt(src.file, src.root);
    if (src.chroma) img = chromaKeyToAlpha(img, src.chromaOpts);
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
        let { w, h, pixels } = crop(img, x0, y0, x1, y1, src.maxDim, rg.opaque);
        if (src.hardAlpha) ({ w, h, pixels } = hardCutAlpha(w, h, pixels, 245));
        if (rg.padBottomTo !== undefined && rg.padBottomTo > h) {
          pixels = padBottom(w, h, pixels, rg.padBottomTo);
          h = rg.padBottomTo;
        }
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
