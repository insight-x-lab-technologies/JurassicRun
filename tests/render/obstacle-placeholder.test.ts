import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderSegmentStrip, SEG_THEMES, SEG_CELL_W, SEG_CELL_H } from '../../scripts/gen-obstacle-placeholder.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('placeholder de segmentos de obstáculo', () => {
  it('renderSegmentStrip gera PNG assinado, largura = 3 células', () => {
    const png = renderSegmentStrip(SEG_THEMES.classic['obstacle.tree']);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(SEG_CELL_W * 3); // IHDR width
    expect(png.readUInt32BE(20)).toBe(SEG_CELL_H); // IHDR height
  });
  it('determinístico (mesmos bytes)', () => {
    const p = SEG_THEMES.classic['obstacle.vine'];
    expect(renderSegmentStrip(p).equals(renderSegmentStrip(p))).toBe(true);
  });
  it('os 6 PNG commitados batem byte-a-byte com o gerado', () => {
    for (const [theme, obstacles] of Object.entries(SEG_THEMES)) {
      for (const [id, parts] of Object.entries(obstacles)) {
        const file = path.join(root, `public/art/themes/${theme}/obstacles/${theme}_${id}.segments.png`);
        expect(readFileSync(file).equals(renderSegmentStrip(parts)), `${theme}/${id}`).toBe(true);
      }
    }
  });
});
