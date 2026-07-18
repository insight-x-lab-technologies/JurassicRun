import { describe, expect, it } from 'vitest';
import { parseSku, skuEffect, COIN_SKU_AMOUNTS } from '@services/purchase/sku';

describe('parseSku', () => {
  it('aceita SKUs conhecidos', () => {
    expect(parseSku('coins:small')).toBe('coins:small');
    expect(parseSku('expansion:volcano')).toBe('expansion:volcano');
  });
  it('rejeita SKU desconhecido, vazio ou lixo', () => {
    expect(parseSku('coins:huge')).toBeNull();
    expect(parseSku('expansion:classic')).toBeNull(); // classic é free, não vendável
    expect(parseSku('')).toBeNull();
    expect(parseSku('nonsense')).toBeNull();
  });
});

describe('skuEffect', () => {
  it('mapeia coins para o valor do pack', () => {
    expect(skuEffect('coins:medium')).toEqual({ kind: 'coins', coins: COIN_SKU_AMOUNTS.medium });
  });
  it('mapeia expansão para o id', () => {
    expect(skuEffect('expansion:glacier')).toEqual({ kind: 'expansion', expansionId: 'glacier' });
  });
});
