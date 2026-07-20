import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { UI_SOURCES, renderUi } from '../../scripts/gen-ui.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('processador de assets de UI (gen-ui)', () => {
  it(
    'renderUi produz um PNG válido por fonte (uma célula por asset, achatando grids)',
    () => {
      const outs = renderUi();
      const expectedCount = UI_SOURCES.reduce(
        (n, s) => n + (s.grid ? s.grid.names.length : s.regions ? s.regions.length : 1),
        0,
      );
      expect(outs.length).toBe(expectedCount);
      for (const { out, png } of outs) {
        expect(png.subarray(0, 8).toString('hex'), out).toBe('89504e470d0a1a0a');
        expect(png.subarray(12, 16).toString('ascii'), out).toBe('IHDR');
      }
    },
    20000,
  );

  it(
    'é determinístico',
    () => {
      // renderUi() decodifica ~20 PNGs de fonte (backgrounds ~2MB, capas ~2.5MB, 10
      // tiras de dino ~400-600KB cada) por pixel a cada chamada (alguns segundos) —
      // timeout estendido em todos os testes que chamam renderUi() (default 5000ms
      // não é mais suficiente desde a Rodada C). Mesmo padrão de
      // tests/render/atlas.test.ts.
      const a = renderUi(), b = renderUi();
      for (const [i, { png }] of a.entries()) expect(png.equals(b[i]!.png)).toBe(true);
    },
    20000,
  );

  it(
    'os arquivos commitados em public/ui batem com o gerado',
    () => {
      for (const { out, png } of renderUi()) {
        const committed = readFileSync(path.join(root, 'public/ui', `${out}.png`));
        expect(committed.equals(png), out).toBe(true);
      }
    },
    20000,
  );

  it(
    'grid gera um asset por célula (botões + ícones)',
    () => {
      const names = renderUi().map((o) => o.out);
      for (const n of ['button.primary', 'button.secondary',
        'icon.daily', 'icon.weekly', 'icon.nest', 'icon.shop', 'icon.expansions',
        'icon.leaderboard', 'icon.settings', 'icon.share', 'icon.donate', 'icon.back']) {
        expect(names, n).toContain(n);
      }
    },
    20000,
  );

  it(
    'regiões geram os assets de medalhas/capas/dinos',
    () => {
      const names = renderUi().map((o) => o.out);
      for (const n of ['emblem', 'statchip', 'medal.gold', 'medal.silver', 'medal.bronze',
        'cover.classic', 'cover.volcano', 'cover.glacier',
        'dino.starter', 'dino.guardian']) {
        expect(names, n).toContain(n);
      }
    },
    20000,
  );

  it(
    'gera as 3 tiras de parallax',
    () => {
      const names = renderUi().map((o) => o.out);
      for (const n of ['parallax.far', 'parallax.mid', 'parallax.near']) {
        expect(names, n).toContain(n);
      }
    },
    20000,
  );

  it(
    'gera a barra de navegação (nav.bar)',
    () => {
      expect(renderUi().map((o) => o.out)).toContain('nav.bar');
    },
    20000,
  );
});
