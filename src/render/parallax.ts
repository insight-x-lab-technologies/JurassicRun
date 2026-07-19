/**
 * Camadas de parallax (REGRA 2): tipos lógicos trocáveis. `primitive` (geométrico) segue
 * suportado no tipo p/ compatibilidade de packs; `PARALLAX_LAYERS` agora usa `sprite`
 * (tiras `parallax.{far,mid,near}` — Fase 8.1). Puramente visuais ⇒ não tocam `src/core/`
 * (determinismo intacto). Ordem do array = profundidade: índice 0 é a mais distante
 * (menor scrollFactor).
 */
export type ParallaxVisual =
  | {
      readonly kind: 'primitive';
      readonly color: number;
      readonly tileWidth: number;
      readonly peakHeight: number;
      readonly baseFromBottom: number;
    }
  | { readonly kind: 'sprite'; readonly texture: string; readonly baseFromBottom: number; readonly dispHeight: number };

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
    visual: { kind: 'sprite', texture: 'parallax.far', baseFromBottom: 64, dispHeight: 52 },
  },
  {
    id: 'bg.layer.mid',
    scrollFactor: 0.4,
    visual: { kind: 'sprite', texture: 'parallax.mid', baseFromBottom: 34, dispHeight: 44 },
  },
  {
    id: 'bg.layer.near',
    scrollFactor: 0.7,
    visual: { kind: 'sprite', texture: 'parallax.near', baseFromBottom: 0, dispHeight: 56 },
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
