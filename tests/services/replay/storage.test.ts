// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  localStorageReplayStorage,
  memoryReplayStorage,
  STORAGE_KEY,
} from '@services/replay/storage';
import { recordReplay, initialReplayState, type StoredReplay } from '@services/replay/store';

function replay(over: Partial<StoredReplay> = {}): StoredReplay {
  return {
    mode: 'daily', seed: 'daily:2026-07-08', timeline: [true, false, true],
    score: 100, distance: 50, food: 3, nearMisses: 1,
    finalHash: 'a'.repeat(32), achievedAt: 1000, ...over,
  };
}

describe('memoryReplayStorage', () => {
  it('round-trip save/load', () => {
    const st = memoryReplayStorage();
    const state = recordReplay(initialReplayState(), replay());
    st.save(state);
    expect(st.load()).toEqual(state);
  });
});

describe('localStorageReplayStorage', () => {
  beforeEach(() => localStorage.clear());

  it('sem chave ⇒ estado inicial', () => {
    expect(localStorageReplayStorage().load()).toEqual(initialReplayState());
  });

  it('round-trip: save persiste e load recupera', () => {
    const st = localStorageReplayStorage();
    const state = recordReplay(initialReplayState(), replay());
    st.save(state);
    expect(localStorageReplayStorage().load()).toEqual(state);
  });

  it('JSON inválido ⇒ estado inicial', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(localStorageReplayStorage().load()).toEqual(initialReplayState());
  });

  it('entrada com timeline não-booleana é filtrada', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        daily: [{ mode: 'daily', seed: 'daily:x', timeline: [1, 'nope'], score: 5, finalHash: 'a'.repeat(32) }],
        weekly: [],
      }),
    );
    expect(localStorageReplayStorage().load().daily).toEqual([]);
  });

  it('entrada sem seed é filtrada; entrada válida sobrevive', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        daily: [
          { seed: '', timeline: [true], finalHash: 'a'.repeat(32) },
          { mode: 'daily', seed: 'daily:ok', timeline: [true, false], score: 9, distance: 1, food: 0, nearMisses: 0, finalHash: 'b'.repeat(32), achievedAt: 5 },
        ],
        weekly: [],
      }),
    );
    const loaded = localStorageReplayStorage().load();
    expect(loaded.daily).toHaveLength(1);
    expect(loaded.daily[0]!.seed).toBe('daily:ok');
  });
});
