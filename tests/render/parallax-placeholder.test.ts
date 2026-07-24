import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PARALLAX_PLACEHOLDER_SPECS, renderPlaceholder } from '../../scripts/gen-parallax-placeholder.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('gerador de parallax placeholder (alpha)', () => {
  it('cobre 3 temas × 4 camadas = 12 fontes', () => {
    expect(PARALLAX_PLACEHOLDER_SPECS).toHaveLength(12);
    const layers = new Set(PARALLAX_PLACEHOLDER_SPECS.map((s) => s.layer));
    expect([...layers].sort()).toEqual(['far', 'impact', 'mid', 'near']);
  });

  it('cada render tem topo 100% transparente e base com conteúdo (alpha vaza)', () => {
    for (const spec of PARALLAX_PLACEHOLDER_SPECS) {
      const { w, h, pixels } = renderPlaceholder(spec.theme, spec.layer);
      expect(w).toBe(spec.w);
      expect(h).toBe(spec.h);
      // linha do topo: todo alpha 0
      let topAlpha = 0;
      for (let x = 0; x < w; x++) topAlpha += pixels[(0 * w + x) * 4 + 3]!;
      expect(topAlpha, `${spec.theme}.${spec.layer} topo`).toBe(0);
      // alguma opacidade no total (silhueta existe)
      let anyOpaque = 0;
      for (let i = 0; i < w * h; i++) if (pixels[i * 4 + 3]! > 200) anyOpaque++;
      expect(anyOpaque, `${spec.theme}.${spec.layer} conteúdo`).toBeGreaterThan(0);
    }
  });

  it('é tileável na horizontal: coluna 0 == coluna w (mesma silhueta ao envolver)', () => {
    const { w, h, pixels } = renderPlaceholder('classic', 'far');
    // a última coluna deve casar com a primeira (continuidade do perfil periódico)
    for (let y = 0; y < h; y++) {
      const a0 = pixels[(y * w + 0) * 4 + 3]!;
      const aL = pixels[(y * w + (w - 1)) * 4 + 3]!;
      expect(Math.abs(a0 - aL), `y=${y}`).toBeLessThanOrEqual(8);
    }
  });

  it('é determinístico', () => {
    const a = renderPlaceholder('volcano', 'near');
    const b = renderPlaceholder('volcano', 'near');
    expect(a.pixels.equals(b.pixels)).toBe(true);
  });

  it('os 12 PNGs-fonte estão commitados', () => {
    for (const spec of PARALLAX_PLACEHOLDER_SPECS) {
      const p = path.join(ROOT, spec.file);
      expect(existsSync(p), spec.file).toBe(true);
      const buf = readFileSync(p);
      expect(buf.subarray(0, 8).toString('hex'), spec.file).toBe('89504e470d0a1a0a');
    }
  });
});
