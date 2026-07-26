// scripts/gen-icons.mjs
// Encoder PNG puro (node:zlib, zero dep) — base compartilhada de TODOS os geradores de asset
// (gen-atlas, gen-ui, gen-app-icon). Mantém o nome do arquivo por já ser o ponto de import de
// `encodePng` em vários módulos e testes.
import { deflateSync } from 'node:zlib';

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
/**
 * Filtragem adaptativa de scanline (PNG spec §9): para cada linha testa os 5 filtros e escolhe
 * o de menor soma de valores absolutos com sinal — a heurística padrão. O encoder emitia sempre
 * filtro 0 (none), o que deixava o deflate sem nada para explorar em arte pintada; com filtro os
 * PNGs gerados (ícones, atlas, UI) encolhem bastante, e é o precache do service worker que
 * agradece. Determinístico: mesma entrada ⇒ mesmos bytes.
 */
const BPP = 4; // RGBA 8 bits

/**
 * Escolhe o filtro de cada scanline testando os 5 candidatos e ficando com o de menor soma de
 * valores absolutos com sinal (heurística padrão da spec). Buffers são reaproveitados entre
 * linhas: alocar 5 por linha dominava o custo e estourava o timeout dos testes de asset.
 */
const scratch = [];
function scratchFor(i, stride) {
  let b = scratch[i];
  if (b === undefined || b.length < stride) { b = Buffer.alloc(stride); scratch[i] = b; }
  return b;
}

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
    const rowOff = y * stride;
    const prevOff = rowOff - stride;
    const hasPrev = y > 0;
    let bestType = 0, bestCost = Infinity, bestBuf = null;

    for (let type = 0; type <= 4; type++) {
      const buf = scratchFor(type, stride);
      let cost = 0;
      for (let x = 0; x < stride; x++) {
        const cur = rgba[rowOff + x];
        const a = x >= BPP ? rgba[rowOff + x - BPP] : 0;
        const b = hasPrev ? rgba[prevOff + x] : 0;
        let v;
        if (type === 0) v = cur;
        else if (type === 1) v = cur - a;
        else if (type === 2) v = cur - b;
        else if (type === 3) v = cur - ((a + b) >> 1);
        else {
          const c = x >= BPP && hasPrev ? rgba[prevOff + x - BPP] : 0;
          const p = a + b - c;
          const pa = p > a ? p - a : a - p;
          const pb = p > b ? p - b : b - p;
          const pc = p > c ? p - c : c - p;
          v = cur - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
        v &= 255;
        buf[x] = v;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) { bestCost = cost; bestType = type; bestBuf = buf; }
    }

    const dst = y * (stride + 1);
    raw[dst] = bestType;
    bestBuf.copy(raw, dst + 1, 0, stride);
  }

  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}



// A composição dos ícones da PWA vive em scripts/gen-app-icon.mjs (usa a arte real). Este
// módulo ficou só com o ENCODER, que é compartilhado por gen-atlas/gen-ui/gen-app-icon.
