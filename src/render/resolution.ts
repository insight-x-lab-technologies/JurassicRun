import {
  VIEW_WIDTH,
  VIEW_HEIGHT,
  MIN_RENDER_SCALE,
  MAX_RENDER_SCALE,
  PARALLAX_SOURCE_WORLD_WIDTH,
} from './constants';

/**
 * Resolução de render (W5) — módulo PURO (sem Phaser, testável).
 *
 * O campo lógico do jogo é 320×180 **unidades de mundo** e isso é travado (determinismo +
 * justiça de leaderboard: todo mundo joga o mesmo campo). Até aqui o canvas também era 320×180
 * **pixels**, e o `Scale.FIT` esticava esse framebuffer minúsculo para a tela inteira — 4,27× a
 * 1366×768 medido em runtime. Nenhuma arte sobrevive a isso.
 *
 * A correção separa os dois eixos: a simulação segue em unidades de mundo; o render multiplica
 * pela escala ao escrever posições/tamanhos em objetos Phaser. `src/core/` não muda.
 *
 * A escala é **adaptativa**, não fixa: o canvas passa a ter exatamente os pixels que o display
 * vai mostrar (1:1, sem reamostragem em nenhuma direção). Resolução fixa alta desperdiçaria
 * fill-rate num celular pequeno; resolução fixa baixa é o bug original.
 */

/**
 * Escala de render para um container de `cssWidth`×`cssHeight` com densidade `dpr`.
 *
 * O canvas é encaixado no container preservando 16:9 (`Scale.FIT`), então o eixo limitante
 * decide quantos px de CSS cabem por unidade de mundo; `dpr` converte para px físicos. O teto
 * evita renderizar 4K/8K por fill-rate, e o piso protege contra container degenerado (0 px
 * durante a montagem do layout).
 */
export function resolveRenderScale(cssWidth: number, cssHeight: number, dpr: number): number {
  const density = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const fit = Math.min(cssWidth / VIEW_WIDTH, cssHeight / VIEW_HEIGHT);
  if (!Number.isFinite(fit) || fit <= 0) return MIN_RENDER_SCALE;
  return Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, fit * density));
}

/** Converte unidade de mundo (simulação) em pixel de render (canvas). */
export function toRenderPx(worldValue: number, scale: number): number {
  return worldValue * scale;
}

/** Tamanho do canvas em px reais para uma escala. Mesma proporção 16:9 do campo lógico. */
export function renderCanvasSize(scale: number): { width: number; height: number } {
  return { width: Math.round(VIEW_WIDTH * scale), height: Math.round(VIEW_HEIGHT * scale) };
}

/**
 * `tileScale` de uma camada de parallax.
 *
 * Uma tira de parallax cobre `PARALLAX_SOURCE_WORLD_WIDTH` unidades de mundo, qualquer que seja
 * sua resolução em pixels. `texWidth / PARALLAX_SOURCE_WORLD_WIDTH` é a densidade da arte (px de
 * textura por unidade de mundo); o tile precisa ser esticado pelo que falta para chegar em
 * `scale` px de render por unidade. Arte mais densa ⇒ menos esticamento ⇒ mais nitidez, e o
 * enquadramento fica idêntico ao de antes (não é zoom, é resolução).
 */
export function parallaxTileScale(texWidth: number, scale: number): number {
  if (!Number.isFinite(texWidth) || texWidth <= 0) return scale; // legado: 1 px = 1 unidade
  return scale / (texWidth / PARALLAX_SOURCE_WORLD_WIDTH);
}
