import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodePng, renderIcon } from '../../scripts/gen-icons.mjs';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const root = fileURLToPath(new URL('../../', import.meta.url));

describe('encodePng', () => {
  it('emite a assinatura PNG e IHDR com as dimensões pedidas', () => {
    const rgba = Buffer.alloc(2 * 3 * 4, 0xff);
    const png = encodePng(2, 3, rgba);
    expect(png.subarray(0, 8).equals(PNG_SIG)).toBe(true);
    // IHDR começa em 8: len(4)+type(4)=16, largura em offset 16, altura em 20 (big-endian)
    expect(png.readUInt32BE(16)).toBe(2);
    expect(png.readUInt32BE(20)).toBe(3);
  });

  it('é determinístico (mesma entrada ⇒ mesmos bytes)', () => {
    const rgba = Buffer.alloc(4 * 4 * 4, 0x33);
    expect(encodePng(4, 4, rgba).equals(encodePng(4, 4, rgba))).toBe(true);
  });
});

describe('renderIcon', () => {
  it('retorna rgba do tamanho esperado', () => {
    expect(renderIcon(192).length).toBe(192 * 192 * 4);
    expect(renderIcon(512, { maskable: true }).length).toBe(512 * 512 * 4);
  });

  it('produz um PNG válido ao ser encodado', () => {
    const png = encodePng(64, 64, renderIcon(64));
    expect(png.subarray(0, 8).equals(PNG_SIG)).toBe(true);
    expect(png.readUInt32BE(16)).toBe(64);
  });
});

describe('ícones comitados em public/icons', () => {
  for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    it(`${name} existe e começa com a assinatura PNG`, () => {
      const p = `${root}public/icons/${name}`;
      expect(existsSync(p)).toBe(true);
      expect(readFileSync(p).subarray(0, 8).equals(PNG_SIG)).toBe(true);
    });
  }
});
