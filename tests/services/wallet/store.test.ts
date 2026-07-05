import { describe, it, expect } from 'vitest';
import {
  initialWalletState,
  coinsForFood,
  addCoins,
  spendCoins,
  type WalletState,
} from '@services/wallet/store';

describe('wallet store', () => {
  it('initial state has zero coins', () => {
    expect(initialWalletState()).toEqual({ coins: 0 });
  });

  it('coinsForFood is 1:1, floored, non-negative', () => {
    expect(coinsForFood(0)).toBe(0);
    expect(coinsForFood(7)).toBe(7);
    expect(coinsForFood(3.9)).toBe(3);
    expect(coinsForFood(-5)).toBe(0);
    expect(coinsForFood(Number.NaN)).toBe(0);
  });

  it('addCoins adds, sanitizes invalid amounts, is immutable', () => {
    const s0 = initialWalletState();
    const s1 = addCoins(s0, 100);
    expect(s1).toEqual({ coins: 100 });
    expect(s0).toEqual({ coins: 0 }); // não mutou
    expect(addCoins(s1, -10)).toEqual({ coins: 100 }); // negativo ⇒ +0
    expect(addCoins(s1, Number.NaN)).toEqual({ coins: 100 });
    expect(addCoins(s1, 2.9)).toEqual({ coins: 102 }); // floor
  });

  it('spendCoins debits when affordable, is immutable', () => {
    const s: WalletState = { coins: 100 };
    const r = spendCoins(s, 30);
    expect(r).toEqual({ state: { coins: 70 }, ok: true });
    expect(s).toEqual({ coins: 100 });
  });

  it('spendCoins rejects insufficient / invalid amount without changing state', () => {
    const s: WalletState = { coins: 20 };
    expect(spendCoins(s, 50)).toEqual({ state: { coins: 20 }, ok: false });
    expect(spendCoins(s, -5)).toEqual({ state: { coins: 20 }, ok: false });
    expect(spendCoins(s, Number.NaN)).toEqual({ state: { coins: 20 }, ok: false });
    expect(spendCoins(s, 0)).toEqual({ state: { coins: 20 }, ok: false });
  });
});
