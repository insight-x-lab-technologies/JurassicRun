/** Traços de dino — modificadores de simulação determinísticos (parte do estado inicial). */
export type DinoTrait = 'none' | 'magnet' | 'doubleFood' | 'tripleFood' | 'startLife' | 'headStart';

/** Modificadores puros que um traço aplica à simulação. */
export interface TraitModifiers {
  /** Ímã sempre ativo (puxa coletáveis, como o power-up magnet). */
  readonly magnetAlways: boolean;
  /** Multiplicador base de comida por coletável (1/2/3). */
  readonly foodMultiplier: number;
  /** Cargas de vida extra iniciais. */
  readonly startExtraLives: number;
  /** Escudo de graça nos primeiros N steps da partida. */
  readonly startShieldSteps: number;
}
