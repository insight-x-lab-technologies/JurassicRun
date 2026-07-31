import { COIN_SKU_AMOUNTS, type Sku } from '@services/purchase/sku';

/** Pacote de moedas da Loja. Valores = fonte única em `@services/purchase/sku`. */
export interface CoinPack {
  readonly id: 'small' | 'medium' | 'large';
  /** SKU vendável — viaja na URL do Ko-fi e no código que o jogador resgata. */
  readonly sku: Sku;
  readonly coins: number;
}

export const COIN_PACKS: readonly CoinPack[] = Object.freeze([
  { id: 'small', sku: 'coins:small', coins: COIN_SKU_AMOUNTS.small },
  { id: 'medium', sku: 'coins:medium', coins: COIN_SKU_AMOUNTS.medium },
  { id: 'large', sku: 'coins:large', coins: COIN_SKU_AMOUNTS.large },
]);
