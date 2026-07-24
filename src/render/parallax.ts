/**
 * Camadas de parallax (REGRA 2): tipos lógicos trocáveis. `primitive` (geométrico) segue
 * suportado no tipo p/ compatibilidade de packs; `PARALLAX_LAYERS` agora usa `sprite`
 * (tiras `parallax.{far,mid,near,impact}` — Fase 9.1). Puramente visuais ⇒ não tocam `src/core/`
 * (determinismo intacto). Ordem do array = profundidade: índice 0 é a mais distante
 * (menor scrollFactor). 4 camadas alpha com scrollFactor crescente (0.15/0.35/0.6/0.85).
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
    scrollFactor: 0.15,
    visual: { kind: 'sprite', texture: 'parallax.far', baseFromBottom: 0, dispHeight: 110 },
  },
  {
    id: 'bg.layer.mid',
    scrollFactor: 0.35,
    visual: { kind: 'sprite', texture: 'parallax.mid', baseFromBottom: 0, dispHeight: 95 },
  },
  {
    id: 'bg.layer.near',
    scrollFactor: 0.6,
    visual: { kind: 'sprite', texture: 'parallax.near', baseFromBottom: 0, dispHeight: 90 },
  },
  {
    id: 'bg.layer.impact',
    scrollFactor: 0.85,
    visual: { kind: 'sprite', texture: 'parallax.impact', baseFromBottom: 0, dispHeight: 80 },
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
