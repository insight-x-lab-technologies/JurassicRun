import { describe, it, expect } from 'vitest';
import { PARALLAX_LAYERS, parallaxTileOffset } from '@render/parallax';

describe('PARALLAX_LAYERS', () => {
  it('tem ao menos 3 camadas', () => {
    expect(PARALLAX_LAYERS.length).toBeGreaterThanOrEqual(3);
  });

  it('usa os ids reservados no registry, únicos', () => {
    const ids = PARALLAX_LAYERS.map((l) => l.id);
    expect(ids).toEqual(['bg.layer.far', 'bg.layer.mid', 'bg.layer.near']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scrollFactor de cada camada em [0,1)', () => {
    for (const l of PARALLAX_LAYERS) {
      expect(l.scrollFactor).toBeGreaterThanOrEqual(0);
      expect(l.scrollFactor).toBeLessThan(1);
    }
  });

  it('scrollFactor estritamente crescente (distante→próximo)', () => {
    for (let i = 1; i < PARALLAX_LAYERS.length; i++) {
      expect(PARALLAX_LAYERS[i]!.scrollFactor).toBeGreaterThan(PARALLAX_LAYERS[i - 1]!.scrollFactor);
    }
  });

  it('toda camada tem um visual sprite completo', () => {
    for (const l of PARALLAX_LAYERS) {
      expect(l.visual.kind).toBe('sprite');
      if (l.visual.kind === 'sprite') {
        expect(l.visual.texture).toMatch(/^parallax\./);
        expect(l.visual.dispHeight).toBeGreaterThan(0);
        expect(l.visual.baseFromBottom).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('parallaxTileOffset', () => {
  it('fator 0 ⇒ deslocamento 0 (fundo imóvel)', () => {
    expect(parallaxTileOffset(1234, 0)).toBe(0);
  });

  it('é proporcional a cameraScrollX', () => {
    expect(parallaxTileOffset(100, 0.4)).toBeCloseTo(40);
    expect(parallaxTileOffset(200, 0.4)).toBeCloseTo(80);
  });

  it('camada distante desloca menos que a próxima para o mesmo scrollX', () => {
    const far = PARALLAX_LAYERS[0]!;
    const near = PARALLAX_LAYERS[PARALLAX_LAYERS.length - 1]!;
    const sx = 500;
    expect(parallaxTileOffset(sx, far.scrollFactor)).toBeLessThan(
      parallaxTileOffset(sx, near.scrollFactor),
    );
  });
});
