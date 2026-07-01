/**
 * Camadas de parallax (REGRA 2): tipos lógicos trocáveis, geométricos agora (`primitive`),
 * sprite depois (Fase 8). Puramente visuais ⇒ não tocam `src/core/` (determinismo intacto).
 * Ordem do array = profundidade: índice 0 é a mais distante (menor scrollFactor).
 */
export type ParallaxVisual =
  | {
      readonly kind: 'primitive';
      readonly color: number;
      readonly tileWidth: number;
      readonly peakHeight: number;
      readonly baseFromBottom: number;
    }
  | { readonly kind: 'sprite'; readonly texture: string };

export interface ParallaxLayer {
  readonly id: string;
  /** Fração do scroll da câmera que a camada acompanha; em [0,1). Menor = mais distante. */
  readonly scrollFactor: number;
  readonly visual: ParallaxVisual;
}

/** Trás→frente. ids batem com os reservados em docs/assets/asset-registry.md. */
export const PARALLAX_LAYERS: readonly ParallaxLayer[] = [
  {
    id: 'bg.layer.far',
    scrollFactor: 0.2,
    visual: { kind: 'primitive', color: 0x6b7a8f, tileWidth: 160, peakHeight: 55, baseFromBottom: 40 },
  },
  {
    id: 'bg.layer.mid',
    scrollFactor: 0.4,
    visual: { kind: 'primitive', color: 0x4f7a5a, tileWidth: 120, peakHeight: 35, baseFromBottom: 18 },
  },
  {
    id: 'bg.layer.near',
    scrollFactor: 0.7,
    visual: { kind: 'primitive', color: 0x2f5233, tileWidth: 64, peakHeight: 50, baseFromBottom: 6 },
  },
];

/**
 * Deslocamento horizontal do padrão de tile de uma camada, dado o scroll da câmera.
 * `tilePositionX = cameraScrollX * scrollFactor` ⇒ camadas com fator menor rolam mais devagar
 * (profundidade). Fator 0 ⇒ imóvel; fator 1 ⇒ acompanha o mundo (nenhuma camada usa 1).
 */
export function parallaxTileOffset(cameraScrollX: number, scrollFactor: number): number {
  return cameraScrollX * scrollFactor;
}
