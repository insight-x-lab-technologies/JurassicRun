// scripts/gen-icons.mjs
// Gera ícones PNG placeholder da PWA (fundo sólido + triângulo, ecoando o dino
// cosmético). Encoder PNG puro via node:zlib — zero dep. Rode `npm run gen:icons`.
// Arte real é Fase 8 (ver docs/assets/specs/pwa-icon.md).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BG = [0x0e, 0x11, 0x16]; // --color-bg
const FG = [0x4e, 0xa1, 0xff]; // --color-primary

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** @param {number} width @param {number} height @param {Buffer} rgba @returns {Buffer} */
export function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const dst = y * (stride + 1);
    raw[dst] = 0; // filtro: none
    rgba.copy(raw, dst + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/** @param {number} size @param {{maskable?:boolean}} [opts] @returns {Buffer} */
export function renderIcon(size, opts = {}) {
  const inset = opts.maskable === true ? 0.24 : 0.14; // safe-zone maior p/ máscara
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = BG[0];
    rgba[i * 4 + 1] = BG[1];
    rgba[i * 4 + 2] = BG[2];
    rgba[i * 4 + 3] = 0xff;
  }
  // triângulo apontando p/ direita (dino): topo-esq, meio-dir, base-esq
  const m = size * inset;
  const ax = m, ay = m;
  const bx = size - m, by = size / 2;
  const cx = m, cy = size - m;
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px + 0.5, y = py + 0.5;
      const w0 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / area;
      const w1 = ((cx - bx) * (y - by) - (cy - by) * (x - bx)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
        const i = (py * size + px) * 4;
        rgba[i] = FG[0];
        rgba[i + 1] = FG[1];
        rgba[i + 2] = FG[2];
        rgba[i + 3] = 0xff;
      }
    }
  }
  return rgba;
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = path.join(root, 'public/icons');
  mkdirSync(dir, { recursive: true });
  const outputs = [
    ['icon-192.png', encodePng(192, 192, renderIcon(192))],
    ['icon-512.png', encodePng(512, 512, renderIcon(512))],
    ['icon-maskable-512.png', encodePng(512, 512, renderIcon(512, { maskable: true }))],
  ];
  for (const [name, buf] of outputs) {
    writeFileSync(path.join(dir, name), buf);
    console.log(`escrito public/icons/${name} (${buf.length} bytes)`);
  }
}

// roda main() só quando executado como script (não no import do teste)
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
