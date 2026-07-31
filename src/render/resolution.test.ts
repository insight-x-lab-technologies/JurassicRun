import { describe, it, expect } from 'vitest';
import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  MIN_RENDER_SCALE,
  MAX_RENDER_SCALE,
  PARALLAX_SOURCE_WORLD_WIDTH,
  RESCALE_EPSILON,
} from './constants';
import {
  toRenderPx,
  renderCanvasSize,
  parallaxTileScale,
  resolveRenderScale,
  shouldRescale,
} from './resolution';

describe('resolveRenderScale', () => {
  it('casa 1:1 com o display: o canvas ganha os px que a tela vai mostrar', () => {
    // 1366×768, dpr 1 ⇒ o eixo limitante é a altura (768/180 = 4,266…).
    const s = resolveRenderScale(1366, 768, 1);
    expect(s).toBeCloseTo(768 / VIEW_HEIGHT, 10);
    // O canvas resultante tem a altura exata do container ⇒ nenhuma reamostragem.
    expect(renderCanvasSize(s).height).toBe(768);
  });

  it('respeita o eixo limitante do FIT (não vaza do container)', () => {
    // Container mais largo que 16:9 ⇒ a altura limita; mais alto ⇒ a largura limita.
    expect(resolveRenderScale(4000, 720, 1)).toBeCloseTo(720 / VIEW_HEIGHT, 10);
    expect(resolveRenderScale(640, 4000, 1)).toBeCloseTo(640 / VIEW_WIDTH, 10);
  });

  it('multiplica pela densidade de pixel da tela (retina)', () => {
    expect(resolveRenderScale(800, 450, 2)).toBeCloseTo(resolveRenderScale(800, 450, 1) * 2, 10);
  });

  it('limita no teto para não renderizar 4K (fill-rate)', () => {
    expect(resolveRenderScale(7680, 4320, 2)).toBe(MAX_RENDER_SCALE);
  });

  it('container degenerado durante a montagem do layout cai no piso', () => {
    expect(resolveRenderScale(0, 0, 1)).toBe(MIN_RENDER_SCALE);
    expect(resolveRenderScale(Number.NaN, 768, 1)).toBe(MIN_RENDER_SCALE);
  });

  it('dpr inválido é tratado como 1 em vez de zerar a escala', () => {
    expect(resolveRenderScale(1366, 768, 0)).toBeCloseTo(resolveRenderScale(1366, 768, 1), 10);
  });

  it('corrige o bug original: nunca fica no framebuffer 320×180 num display grande', () => {
    const s = resolveRenderScale(1366, 768, 1);
    expect(renderCanvasSize(s).width).toBeGreaterThan(VIEW_WIDTH * 4);
  });
});

describe('toRenderPx', () => {
  it('converte unidade de mundo em pixel de render', () => {
    expect(toRenderPx(0, 4)).toBe(0);
    expect(toRenderPx(1, 4)).toBe(4);
    expect(toRenderPx(VIEW_WIDTH, 4)).toBe(VIEW_WIDTH * 4);
  });

  it('preserva sinal e fração (posições interpoladas do dino)', () => {
    expect(toRenderPx(-2, 3)).toBe(-6);
    expect(toRenderPx(0.5, 3)).toBe(1.5);
  });
});

describe('renderCanvasSize', () => {
  it('mantém a proporção do campo lógico 320x180 (16:9)', () => {
    const { width, height } = renderCanvasSize(4.2666);
    expect(width / height).toBeCloseTo(VIEW_WIDTH / VIEW_HEIGHT, 2);
  });
});

describe('shouldRescale', () => {
  it('escala idêntica não redimensiona (evita recursão com o próprio resize)', () => {
    expect(shouldRescale(3.66, 3.66)).toBe(false);
  });

  it('variação abaixo da margem não redimensiona (a rotação dispara uma rajada de resizes)', () => {
    const next = 4 * (1 + RESCALE_EPSILON / 2);
    expect(shouldRescale(4, next)).toBe(false);
  });

  it('variação acima da margem redimensiona', () => {
    expect(shouldRescale(3.66, 6)).toBe(true);
    expect(shouldRescale(6, 3.66)).toBe(true);
  });

  it('entradas não finitas ou não positivas nunca redimensionam', () => {
    expect(shouldRescale(4, Number.NaN)).toBe(false);
    expect(shouldRescale(Number.NaN, 4)).toBe(false);
    expect(shouldRescale(4, 0)).toBe(false);
    expect(shouldRescale(0, 4)).toBe(false);
  });
});

describe('parallaxTileScale', () => {
  it('textura de 1 px por unidade de mundo estica pela escala inteira', () => {
    expect(parallaxTileScale(PARALLAX_SOURCE_WORLD_WIDTH, 6)).toBe(6);
  });

  it('arte de origem mais densa reduz o esticamento (mais nitidez)', () => {
    const dense = PARALLAX_SOURCE_WORLD_WIDTH * 3;
    expect(parallaxTileScale(dense, 6)).toBeCloseTo(2, 10);
    expect(parallaxTileScale(dense, 6)).toBeLessThan(parallaxTileScale(PARALLAX_SOURCE_WORLD_WIDTH, 6));
  });

  it('textura na densidade de render fica 1:1 (sem interpolação)', () => {
    expect(parallaxTileScale(PARALLAX_SOURCE_WORLD_WIDTH * 6, 6)).toBeCloseTo(1, 10);
  });

  it('largura inválida cai no legado em vez de dividir por zero', () => {
    expect(parallaxTileScale(0, 5)).toBe(5);
    expect(parallaxTileScale(Number.NaN, 5)).toBe(5);
  });
});
