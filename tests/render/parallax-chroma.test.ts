import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng } from '../../scripts/gen-atlas.mjs';

/**
 * Guarda de regressão: as tiras de parallax por tema NÃO podem ter pixel chroma-ish opaco
 * (roxo/verde muddy) nas colunas de borda. Esse resíduo (descontaminação do chroma-key) só
 * aparece na COSTURA de tiling durante o scroll — foi um Critical de review que a verificação
 * visual do frame inicial não pegava. Testa o ASSET COMMITADO (o que o jogo consome), não o
 * pipeline, para travar o defeito no arquivo final.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function isChromaish(r: number, g: number, b: number, a: number): boolean {
  return a > 128 && ((r > 110 && g < 90 && b > 100) || (r < 90 && g > 140 && b < 90));
}

describe('parallax por tema — bordas sem chroma (regressão da costura de tiling)', () => {
  const layers = ['far', 'mid', 'near'] as const;
  const themes = ['classic', 'volcano', 'glacier'] as const;
  for (const layer of layers) {
    for (const theme of themes) {
      it(`parallax.${layer}.${theme}.png não tem chroma opaco nas colunas de borda`, () => {
        const file = path.join(ROOT, 'public/ui', `parallax.${layer}.${theme}.png`);
        const { w, h, rgba } = decodePng(readFileSync(file));
        let hits = 0;
        for (const x of [0, 1, w - 2, w - 1]) {
          for (let y = 0; y < h; y++) {
            const i = (y * w + x) * 4;
            if (isChromaish(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, rgba[i + 3]!)) hits++;
          }
        }
        expect(hits, `${layer}.${theme}: ${hits} pixels chroma opacos nas bordas`).toBe(0);
      });
    }
  }
});
