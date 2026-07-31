// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LEGACY_STORAGE_KEYS,
  purgeLegacyKeys,
  purgeLegacyStorage,
  type LegacyStore,
} from '@services/storage/legacy';
import { STORAGE_KEY as PROFILE_KEY } from '@services/profile/storage';
import { STORAGE_KEY as ENTITLEMENTS_KEY } from '@services/entitlements/storage';
import { STORAGE_KEY as LEADERBOARD_KEY } from '@services/leaderboard/storage';
import { STORAGE_KEY as REPLAY_KEY } from '@services/replay/storage';
import { STORAGE_KEY as WALLET_KEY } from '@services/wallet/storage';
import { STORAGE_KEY as TROPHY_KEY } from '@services/trophy/storage';
import { STORAGE_KEY as NEST_KEY } from '@services/nest/storage';
import { STORAGE_KEY as SETTINGS_KEY } from '@services/settings/storage';

function fakeStore(initial: Record<string, string>): LegacyStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => {
      const v = data[k];
      return v === undefined ? null : v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('purgeLegacyKeys', () => {
  it('remove as chaves legadas presentes e devolve o que removeu', () => {
    const store = fakeStore({
      'jurassicrun.replays.v1': '{}',
      'jurassicrun.replays.v2': '{}',
      'jurassicrun.leaderboard.v1': '{}',
    });
    const removed = purgeLegacyKeys(store);
    expect(removed.sort()).toEqual([...LEGACY_STORAGE_KEYS].sort());
    expect(store.data).toEqual({});
  });

  it('não toca em chave não listada', () => {
    const store = fakeStore({ 'jurassicrun.replays.v1': '{}', 'jurassicrun.wallet.v1': '{"coins":10}' });
    expect(purgeLegacyKeys(store)).toEqual(['jurassicrun.replays.v1']);
    expect(store.data).toEqual({ 'jurassicrun.wallet.v1': '{"coins":10}' });
  });

  it('devolve [] e não chama removeItem quando nenhuma legada existe', () => {
    const store = fakeStore({ 'jurassicrun.wallet.v1': '{}' });
    const spy = vi.spyOn(store, 'removeItem');
    expect(purgeLegacyKeys(store)).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('aceita uma lista de chaves customizada', () => {
    const store = fakeStore({ a: '1', b: '2' });
    expect(purgeLegacyKeys(store, ['a'])).toEqual(['a']);
    expect(store.data).toEqual({ b: '2' });
  });
});

describe('purgeLegacyStorage', () => {
  beforeEach(() => localStorage.clear());

  it('apaga as chaves legadas do localStorage real', () => {
    localStorage.setItem('jurassicrun.replays.v2', '{}');
    localStorage.setItem('jurassicrun.wallet.v1', '{}');
    expect(purgeLegacyStorage()).toEqual(['jurassicrun.replays.v2']);
    expect(localStorage.getItem('jurassicrun.replays.v2')).toBeNull();
    expect(localStorage.getItem('jurassicrun.wallet.v1')).toBe('{}');
  });

  it('devolve [] sem lançar quando o storage recusa a remoção', () => {
    localStorage.setItem('jurassicrun.replays.v1', '{}');
    const spy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => purgeLegacyStorage()).not.toThrow();
    expect(purgeLegacyStorage()).toEqual([]);
    spy.mockRestore();
  });
});

describe('invariante de chaves', () => {
  it('nenhuma chave legada coincide com uma chave viva', () => {
    const live = [
      PROFILE_KEY, ENTITLEMENTS_KEY, LEADERBOARD_KEY, REPLAY_KEY,
      WALLET_KEY, TROPHY_KEY, NEST_KEY, SETTINGS_KEY,
    ];
    for (const legacy of LEGACY_STORAGE_KEYS) {
      expect(live).not.toContain(legacy);
    }
  });
});
