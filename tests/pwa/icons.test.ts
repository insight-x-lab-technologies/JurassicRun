import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../../scripts/gen-icons.mjs';
import { renderAppIcon, APP_ICONS } from '../../scripts/gen-app-icon.mjs';

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

describe('renderAppIcon (ícone composto da arte real)', () => {
  it('retorna rgba do tamanho esperado', () => {
    expect(renderAppIcon(192).length).toBe(192 * 192 * 4);
    expect(renderAppIcon(512, { maskable: true }).length).toBe(512 * 512 * 4);
  });

  it('é totalmente OPACO — ícone de SO não pode vazar o fundo do sistema', () => {
    const rgba = renderAppIcon(96);
    for (let i = 0; i < 96 * 96; i++) expect(rgba[i * 4 + 3]).toBe(255);
  });

  it('o assunto fica centrado e o canto é fundo (contraste centro × canto)', () => {
    const size = 128;
    const rgba = renderAppIcon(size);
    const at = (x: number, y: number) => {
      const i = (y * size + x) * 4;
      return (rgba[i]! + rgba[i + 1]! + rgba[i + 2]!) / 3;
    };
    // moeda dourada no centro, fundo escuro no canto
    expect(at(size / 2, size / 2)).toBeGreaterThan(at(1, 1) + 60);
  });

  it('maskable respeita a safe-zone: o conteúdo cabe no círculo central de 80%', () => {
    const size = 128;
    const rgba = renderAppIcon(size, { maskable: true });
    const c = (size - 1) / 2;
    // Fora da safe-zone só pode haver FUNDO — nada do assunto dourado nem aro.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x - c, y - c) <= 0.4 * size) continue;
        const i = (y * size + x) * 4;
        const [r, g, b] = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!];
        expect(r < 70 && g < 70 && b < 80, `conteúdo fora da safe-zone em ${x},${y}`).toBe(true);
      }
    }
  });

  it('é determinístico', () => {
    expect(Buffer.from(renderAppIcon(64)).equals(Buffer.from(renderAppIcon(64)))).toBe(true);
  });
});

describe('ícones comitados em public/icons', () => {
  for (const { name, size } of APP_ICONS) {
    it(`${name} existe, é PNG e tem ${size}×${size}`, () => {
      const p = `${root}public/icons/${name}`;
      expect(existsSync(p)).toBe(true);
      const buf = readFileSync(p);
      expect(buf.subarray(0, 8).equals(PNG_SIG)).toBe(true);
      expect(buf.readUInt32BE(16)).toBe(size);
      expect(buf.readUInt32BE(20)).toBe(size);
    });
  }

  it('index.html aponta o apple-touch-icon para o ícone de 180 (iOS)', () => {
    const html = readFileSync(`${root}index.html`, 'utf8');
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*href="icons\/icon-180\.png"/);
  });
});
