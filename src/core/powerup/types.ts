/** Tipos de power-up. Extensível: 3.2 adiciona 'slowMo'. */
export type PowerupKind = 'shield' | 'extraLife' | 'magnet' | 'doubleCoin';

/** Efeito temporário ativo: quantos steps ainda valem. Vida extra NÃO é um efeito
 * temporário (é uma carga em WorldState.extraLives) e não entra aqui. */
export interface ActiveEffect {
  kind: PowerupKind;
  remaining: number;
}
