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

  it('é tileável na horizontal: sem LINHA de costura no wrap (altura da silhueta casa)', () => {
    // A costura de tiling que o 9.1 elimina é uma LINHA vertical: a borda esquerda e a direita
    // precisam estar no mesmo estado com ~mesma altura de silhueta. Comparar por-pixel com
    // tolerância-0 seria estrito demais — a borda superior é dura e o `Math.round` do perfil pode
    // diferir 1px entre a 1ª e a última coluna (invisível). Então comparamos a ALTURA DE
    // PREENCHIMENTO (nº de pixels opacos, silhueta contígua ⇒ altura = h − topo) da coluna 0 vs a
    // última: se diferirem por poucos px, não há linha de costura. Inclui `impact` (esparso): o
    // gating por cossenos sem fase põe x=0 no MÁXIMO ⇒ ambas as bordas preenchidas (clump atravessa
    // a costura), o mesmo estado ⇒ alturas próximas.
    const fillHeight = (pixels: Buffer, w: number, h: number, x: number) => {
      let n = 0;
      for (let y = 0; y < h; y++) if (pixels[(y * w + x) * 4 + 3]! > 128) n++;
      return n;
    };
    for (const { theme, layer } of [
      { theme: 'classic', layer: 'far' },
      { theme: 'volcano', layer: 'near' },
      { theme: 'classic', layer: 'impact' },
      { theme: 'glacier', layer: 'impact' },
    ]) {
      const { w, h, pixels } = renderPlaceholder(theme, layer);
      const left = fillHeight(pixels, w, h, 0);
      const right = fillHeight(pixels, w, h, w - 1);
      expect(Math.abs(left - right), `${theme}.${layer}: costura ${left} vs ${right}`).toBeLessThanOrEqual(2);
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
