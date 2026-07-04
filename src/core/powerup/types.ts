/** Tipos de power-up. */
export type PowerupKind = 'shield' | 'extraLife' | 'magnet' | 'doubleCoin' | 'slowMo';

/** Efeito temporário ativo: quantos steps ainda valem. Vida extra NÃO é um efeito
 * temporário (é uma carga em WorldState.extraLives) e não entra aqui. */
export interface ActiveEffect {
  kind: PowerupKind;
  remaining: number;
}
