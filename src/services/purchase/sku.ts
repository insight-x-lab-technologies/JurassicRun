/** SKUs vendáveis pelo gateway (8.4). `classic` é free ⇒ não é SKU. */
export type Sku =
  | 'coins:small'
  | 'coins:medium'
  | 'coins:large'
  | 'expansion:volcano'
  | 'expansion:glacier';

export type SkuKind = 'coins' | 'expansion';

export type SkuEffect =
  | { readonly kind: 'coins'; readonly coins: number }
  | { readonly kind: 'expansion'; readonly expansionId: string };

/** Fonte única dos valores dos coin packs (placeholders de tuning, Fase 8). */
export const COIN_SKU_AMOUNTS = { small: 100, medium: 500, large: 1200 } as const;

const CATALOG: Record<Sku, SkuEffect> = {
  'coins:small': { kind: 'coins', coins: COIN_SKU_AMOUNTS.small },
  'coins:medium': { kind: 'coins', coins: COIN_SKU_AMOUNTS.medium },
  'coins:large': { kind: 'coins', coins: COIN_SKU_AMOUNTS.large },
  'expansion:volcano': { kind: 'expansion', expansionId: 'volcano' },
  'expansion:glacier': { kind: 'expansion', expansionId: 'glacier' },
};

export function parseSku(raw: string): Sku | null {
  return Object.prototype.hasOwnProperty.call(CATALOG, raw) ? (raw as Sku) : null;
}

export function skuEffect(sku: Sku): SkuEffect {
  return CATALOG[sku];
}
