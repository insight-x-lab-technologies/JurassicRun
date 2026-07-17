/** Fatos de ambiente lidos pela casca (sem DOM aqui) para decidir a dica de girar. */
export interface OrientationFacts {
  /** Viewport em retrato (altura ≥ largura). */
  readonly portrait: boolean;
  /** Ponteiro primário grosso (toque) — evita sugerir girar num desktop de janela estreita. */
  readonly coarsePointer: boolean;
}

/**
 * A dica "gire para paisagem" só faz sentido em dispositivos de toque em retrato:
 * o campo de jogo é 16:9 fixo (paisagem) e vira uma faixa fina em retrato.
 */
export function shouldSuggestRotate(facts: OrientationFacts): boolean {
  return facts.portrait && facts.coarsePointer;
}
