/** Pacote de moedas da Loja. Honor-system: crédito instantâneo, sem cobrança (gateway Fase 8). */
export interface CoinPack {
  readonly id: string;
  readonly coins: number;
}

/** Catálogo de pacotes. Valores placeholder de tuning (Fase 8). */
export const COIN_PACKS: readonly CoinPack[] = Object.freeze([
  { id: 'small', coins: 100 },
  { id: 'medium', coins: 500 },
  { id: 'large', coins: 1200 },
]);
