import { describe, it, expect } from 'vitest';
import { COIN_PACKS } from '@app/shop/packs';

describe('coin packs catalog', () => {
  it('has packs with unique ids and positive coin amounts', () => {
    expect(COIN_PACKS.length).toBeGreaterThan(0);
    const ids = COIN_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of COIN_PACKS) expect(p.coins).toBeGreaterThan(0);
  });

  it('cada pacote carrega o SKU correspondente e a quantidade do catálogo', () => {
    expect(COIN_PACKS.map((p) => p.sku)).toEqual(['coins:small', 'coins:medium', 'coins:large']);
    for (const p of COIN_PACKS) expect(p.sku).toBe(`coins:${p.id}`);
  });
});
