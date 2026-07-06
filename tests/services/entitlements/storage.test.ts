// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  memoryEntitlementsStorage,
  localStorageEntitlementsStorage,
  STORAGE_KEY,
} from '@services/entitlements/storage';
import { initialEntitlementsState } from '@services/entitlements/store';
import { DEFAULT_EXPANSION_ID } from '@services/entitlements/catalog';

describe('entitlements storage', () => {
  it('memory faz round-trip', () => {
    const s = memoryEntitlementsStorage();
    s.save({ unlocked: [DEFAULT_EXPANSION_ID, 'volcano'], activeId: 'volcano' });
    expect(s.load().activeId).toBe('volcano');
  });

  describe('localStorage', () => {
    beforeEach(() => localStorage.clear());

    it('sem valor devolve o estado inicial', () => {
      expect(localStorageEntitlementsStorage().load()).toEqual(initialEntitlementsState());
    });

    it('faz round-trip real', () => {
      const store = localStorageEntitlementsStorage();
      store.save({ unlocked: [DEFAULT_EXPANSION_ID, 'volcano'], activeId: 'volcano' });
      expect(store.load()).toEqual({ unlocked: [DEFAULT_EXPANSION_ID, 'volcano'], activeId: 'volcano' });
    });

    it('JSON inválido cai no estado inicial', () => {
      localStorage.setItem(STORAGE_KEY, '{corrompido');
      expect(localStorageEntitlementsStorage().load()).toEqual(initialEntitlementsState());
    });

    it('filtra ids desconhecidos e garante o DEFAULT', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked: ['fantasma', 'volcano'], activeId: 'fantasma' }));
      const s = localStorageEntitlementsStorage().load();
      expect(s.unlocked).toContain(DEFAULT_EXPANSION_ID);
      expect(s.unlocked).toContain('volcano');
      expect(s.unlocked).not.toContain('fantasma');
    });

    it('activeId não-desbloqueado resolve para o DEFAULT', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked: [DEFAULT_EXPANSION_ID], activeId: 'volcano' }));
      expect(localStorageEntitlementsStorage().load().activeId).toBe(DEFAULT_EXPANSION_ID);
    });
  });
});
