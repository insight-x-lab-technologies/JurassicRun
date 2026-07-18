// scripts/gen-atlas.mjs
// Gerador de atlas placeholder com shapes por célula. Encoder PNG puro — zero dep.
// Rode `npm run gen:atlas`.

import { encodePng } from './gen-icons.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const CELL = 64;
export const COLS = 4;

export const ATLAS_FRAMES = [
  { id: 'dino.default', color: 0xcc5544, shape: 'triangle' },
  { id: 'obstacle.tree', color: 0x6b4a2f, shape: 'rect' },
  { id: 'obstacle.vine', color: 0x2f6b2f, shape: 'rect' },
  { id: 'obstacle.boulder', color: 0x808896, shape: 'circle' },
  { id: 'obstacle.stalactite', color: 0x9aa3b2, shape: 'triangle' },
  { id: 'bird.coin', color: 0xffd54a, shape: 'circle' },
  { id: 'powerup.shield', color: 0x4ac0ff, shape: 'circle' },
  { id: 'powerup.extraLife', color: 0xff5a7a, shape: 'circle' },
  { id: 'powerup.magnet', color: 0xc061ff, shape: 'circle' },
  { id: 'powerup.doubleCoin', color: 0xffe14a, shape: 'circle' },
  { id: 'powerup.slowMo', color: 0x66ffcc, shape: 'circle' },
];

const ROWS = Math.ceil(ATLAS_FRAMES.length / COLS);
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;
const MARGIN = 8;

function fillRect(rgba, w, cx, cy, x0, y0, x1, y1, color) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  for (let y = Math.max(0, y0); y < Math.min(cy, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const i = (y * w + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
}

function drawRect(rgba, w, cellX, cellY, color) {
  const x0 = cellX + MARGIN;
  const y0 = cellY + MARGIN;
  const x1 = cellX + CELL - MARGIN;
  const y1 = cellY + CELL - MARGIN;
  fillRect(rgba, w, w, cellY + CELL, x0, y0, x1, y1, color);
}

function drawCircle(rgba, w, cellX, cellY, color) {
  const cx = cellX + CELL / 2;
  const cy = cellY + CELL / 2;
  const radius = (CELL - 2 * MARGIN) / 2;
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  for (let y = cellY; y < cellY + CELL; y++) {
    for (let x = cellX; x < cellX + CELL; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= radius * radius) {
        const i = (y * w + x) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  }
}

function drawTriangle(rgba, w, cellX, cellY, color) {
  // Right-pointing triangle: vertices at (x0, y0), (x1, y1), (x0, y2)
  const x0 = cellX + MARGIN;
  const y0 = cellY + MARGIN;
  const x1 = cellX + CELL - MARGIN;
  const y1 = cellY + CELL / 2;
  const y2 = cellY + CELL - MARGIN;

  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;

  // Barycentric coordinates for triangle fill
  const area = (x1 - x0) * (y2 - y0) - (x0 - x0) * (y1 - y0);

  for (let py = cellY; py < cellY + CELL; py++) {
    for (let px = cellX; px < cellX + CELL; px++) {
      const x = px + 0.5;
      const y = py + 0.5;

      const w0 = ((x1 - x0) * (y - y0) - (x0 - x0) * (x - x0)) / area;
      const w1 = ((x0 - x1) * (y - y1) - (y1 - y1) * (x - x1)) / area;
      const w2 = 1 - w0 - w1;

      if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
        const i = (py * w + px) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  }
}

export function renderAtlas() {
  // Create transparent RGBA buffer
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);

  // Fill all with transparent (alpha=0)
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    rgba[i * 4 + 3] = 0;
  }

  // Draw each frame
  for (let idx = 0; idx < ATLAS_FRAMES.length; idx++) {
    const frame = ATLAS_FRAMES[idx];
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const cellX = col * CELL;
    const cellY = row * CELL;

    if (frame.shape === 'rect') {
      drawRect(rgba, WIDTH, cellX, cellY, frame.color);
    } else if (frame.shape === 'circle') {
      drawCircle(rgba, WIDTH, cellX, cellY, frame.color);
    } else if (frame.shape === 'triangle') {
      drawTriangle(rgba, WIDTH, cellX, cellY, frame.color);
    }
  }

  // Encode PNG
  const png = encodePng(WIDTH, HEIGHT, rgba);

  // Build JSON metadata
  const frames = {};
  for (let idx = 0; idx < ATLAS_FRAMES.length; idx++) {
    const frame = ATLAS_FRAMES[idx];
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = col * CELL;
    const y = row * CELL;

    frames[frame.id] = {
      frame: { x, y, w: CELL, h: CELL },
      rotated: false,
      trimmed: false,
      sourceSize: { w: CELL, h: CELL },
      spriteSourceSize: { x: 0, y: 0, w: CELL, h: CELL },
    };
  }

  const json = {
    frames,
    meta: {
      image: 'entities.png',
      size: { w: WIDTH, h: HEIGHT },
      scale: '1',
    },
  };

  return { png, json };
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = path.join(root, 'public/atlas');
  mkdirSync(dir, { recursive: true });

  const { png, json } = renderAtlas();

  const pngPath = path.join(dir, 'entities.png');
  const jsonPath = path.join(dir, 'entities.json');

  writeFileSync(pngPath, png);
  console.log(`escrito public/atlas/entities.png (${png.length} bytes)`);

  writeFileSync(jsonPath, JSON.stringify(json, null, 2));
  console.log(`escrito public/atlas/entities.json`);
}

// roda main() só quando executado como script (não no import do teste)
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
