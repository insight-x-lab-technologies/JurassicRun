import { describe, it, expect } from 'vitest';
import { chromaKeyToAlpha } from '../../scripts/gen-atlas.mjs';

/** Constrói um {w,h,rgba} com fundo `key` e um pixel de conteúdo em (cx,cy). */
function img(w: number, h: number, key: [number, number, number], cx: number, cy: number, content: [number, number, number]) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i*4]=key[0]; rgba[i*4+1]=key[1]; rgba[i*4+2]=key[2]; rgba[i*4+3]=255; }
  const d = (cy * w + cx) * 4; rgba[d]=content[0]; rgba[d+1]=content[1]; rgba[d+2]=content[2]; rgba[d+3]=255;
  return { w, h, rgba };
}

describe('chromaKeyToAlpha', () => {
  it('zera o alpha do fundo magenta e mantém o conteúdo', () => {
    const out = chromaKeyToAlpha(img(4, 4, [255, 0, 255], 1, 1, [200, 180, 40]));
    expect(out.rgba[(0 * 4 + 0) * 4 + 3]).toBe(0);      // canto = fundo → transparente
    expect(out.rgba[(1 * 4 + 1) * 4 + 3]).toBe(255);    // conteúdo → opaco
  });

  it('auto-detecta chroma verde', () => {
    const out = chromaKeyToAlpha(img(4, 4, [0, 255, 0], 2, 2, [180, 140, 30]));
    expect(out.rgba[0 * 4 + 3]).toBe(0);
    expect(out.rgba[(2 * 4 + 2) * 4 + 3]).toBe(255);
  });

  it('não muta a entrada', () => {
    const src = img(2, 2, [255, 0, 255], 0, 0, [10, 20, 30]);
    const before = Buffer.from(src.rgba);
    chromaKeyToAlpha(src);
    expect(src.rgba.equals(before)).toBe(true);
  });
});
