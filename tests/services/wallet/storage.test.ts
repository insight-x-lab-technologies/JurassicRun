// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  memoryWalletStorage,
  localStorageWalletStorage,
  STORAGE_KEY,
} from '@services/wallet/storage';

describe('wallet storage', () => {
  it('memory storage round-trips', () => {
    const s = memoryWalletStorage();
    expect(s.load()).toEqual({ coins: 0 });
    s.save({ coins: 42 });
    expect(s.load()).toEqual({ coins: 42 });
  });

  describe('localStorage storage', () => {
    beforeEach(() => localStorage.clear());

    it('empty key ⇒ initial state', () => {
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
    });

    it('round-trips through localStorage', () => {
      const s = localStorageWalletStorage();
      s.save({ coins: 123 });
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ coins: 123 });
      expect(localStorageWalletStorage().load()).toEqual({ coins: 123 });
    });

    it('invalid JSON ⇒ initial state', () => {
      localStorage.setItem(STORAGE_KEY, 'not json{');
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
    });

    it('wrong shape / negative / non-numeric coins ⇒ 0', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ coins: -9 }));
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ coins: 'x' }));
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
      localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
    });
  });
});
