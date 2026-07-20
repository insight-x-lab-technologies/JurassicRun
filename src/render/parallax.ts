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
    // W5+: dispHeight = altura NATURAL da textura em unidades de mundo (px ÷ densidade
    // 2172/720). Valor menor fazia a TileSprite repetir na vertical e o topo transparente da
    // repetição virava um corte reto no céu; maior cortava a arte. baseFromBottom 0: a tira
    // já vem estendida até o chão pelo gen-ui (saia opaca), então a base nunca "flutua".
    visual: { kind: 'sprite', texture: 'parallax.far', baseFromBottom: 0, dispHeight: 116 },
  },
  {
    id: 'bg.layer.mid',
    scrollFactor: 0.4,
    visual: { kind: 'sprite', texture: 'parallax.mid', baseFromBottom: 0, dispHeight: 78 },
  },
  {
    id: 'bg.layer.near',
    scrollFactor: 0.7,
    visual: { kind: 'sprite', texture: 'parallax.near', baseFromBottom: 0, dispHeight: 81.5 },
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
