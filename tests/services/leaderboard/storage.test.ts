// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { localStorageLeaderboardStorage, STORAGE_KEY } from '@services/leaderboard/storage';
import { initialLeaderboardState, type LeaderboardState } from '@services/leaderboard/store';

const sample: LeaderboardState = {
  endless: [{ seed: 'endless:X', score: 50, distance: 100, food: 2, nearMisses: 1, achievedAt: 123 }],
  daily: [],
  weekly: [],
  bestEndlessLevel: 4,
};

describe('localStorageLeaderboardStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a saved state', () => {
    const st = localStorageLeaderboardStorage();
    st.save(sample);
    expect(st.load()).toEqual(sample);
  });

  it('returns initial state when nothing stored', () => {
    expect(localStorageLeaderboardStorage().load()).toEqual(initialLeaderboardState());
  });

  it('returns initial state on invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(localStorageLeaderboardStorage().load()).toEqual(initialLeaderboardState());
  });

  it('drops malformed entries and sanitizes numbers', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      endless: [
        { seed: 'ok', score: 10.9, distance: 5, food: 1, nearMisses: 0, achievedAt: 9 },
        { seed: '', score: 5 },           // empty seed ⇒ dropped
        { score: 3 },                     // missing seed ⇒ dropped
        'garbage',                        // not an object ⇒ dropped
      ],
      daily: 'nope',                      // not an array ⇒ []
      weekly: [],
      bestEndlessLevel: -3,               // ⇒ 0
    }));
    const loaded = localStorageLeaderboardStorage().load();
    expect(loaded.endless).toEqual([
      { seed: 'ok', score: 10, distance: 5, food: 1, nearMisses: 0, achievedAt: 9 },
    ]);
    expect(loaded.daily).toEqual([]);
    expect(loaded.bestEndlessLevel).toBe(0);
  });
});
