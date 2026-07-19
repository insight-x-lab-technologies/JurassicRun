import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { UI_SOURCES, renderUi } from '../../scripts/gen-ui.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('processador de assets de UI (gen-ui)', () => {
  it('renderUi produz um PNG válido por fonte', () => {
    const outs = renderUi();
    expect(outs.length).toBe(UI_SOURCES.length);
    for (const { out, png } of outs) {
      expect(png.subarray(0, 8).toString('hex'), out).toBe('89504e470d0a1a0a');
      expect(png.subarray(12, 16).toString('ascii'), out).toBe('IHDR');
    }
  });

  it(
    'é determinístico',
    () => {
      // renderUi() decodifica ~5 PNGs grandes (backgrounds ~2MB) por pixel a cada
      // chamada (~1,5-3s) — timeout estendido p/ as 2 chamadas (default 5000ms é
      // justo). Mesmo padrão de tests/render/atlas.test.ts.
      const a = renderUi(), b = renderUi();
      for (const [i, { png }] of a.entries()) expect(png.equals(b[i]!.png)).toBe(true);
    },
    20000,
  );

  it('os arquivos commitados em public/ui batem com o gerado', () => {
    for (const { out, png } of renderUi()) {
      const committed = readFileSync(path.join(root, 'public/ui', `${out}.png`));
      expect(committed.equals(png), out).toBe(true);
    }
  });
});
