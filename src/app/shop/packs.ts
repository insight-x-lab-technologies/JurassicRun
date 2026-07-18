import { COIN_SKU_AMOUNTS } from '@services/purchase/sku';

/** Pacote de moedas da Loja. Valores = fonte única em `@services/purchase/sku`. */
export interface CoinPack {
  readonly id: 'small' | 'medium' | 'large';
  readonly coins: number;
}

export const COIN_PACKS: readonly CoinPack[] = Object.freeze([
  { id: 'small', coins: COIN_SKU_AMOUNTS.small },
  { id: 'medium', coins: COIN_SKU_AMOUNTS.medium },
  { id: 'large', coins: COIN_SKU_AMOUNTS.large },
]);
