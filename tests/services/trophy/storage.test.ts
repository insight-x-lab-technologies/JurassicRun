// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { localStorageTrophyStorage, memoryTrophyStorage, STORAGE_KEY } from '@services/trophy/storage';
import { initialTrophyState, type TrophyState } from '@services/trophy/store';

const sample: TrophyState = {
  stats: { gamesPlayed: 3, totalFood: 12, totalDistance: 900, bestDistance: 400, bestNearMisses: 4, bestScore: 88 },
  unlocked: ['firstFlight'],
};

describe('memoryTrophyStorage', () => {
  it('faz round-trip', () => {
    const s = memoryTrophyStorage();
    s.save(sample);
    expect(s.load()).toEqual(sample);
  });
});

describe('localStorageTrophyStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trip via localStorage', () => {
    const s = localStorageTrophyStorage();
    s.save(sample);
    expect(localStorageTrophyStorage().load()).toEqual(sample);
  });

  it('sem dado salvo ⇒ estado inicial', () => {
    expect(localStorageTrophyStorage().load()).toEqual(initialTrophyState());
  });

  it('JSON inválido ⇒ estado inicial', () => {
    localStorage.setItem(STORAGE_KEY, '{nope');
    expect(localStorageTrophyStorage().load()).toEqual(initialTrophyState());
  });

  it('filtra ids desconhecidos de unlocked e saneia stats inválidos', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      stats: { gamesPlayed: -2, totalFood: 5.9, totalDistance: NaN, bestDistance: 10, bestNearMisses: 'x', bestScore: 3 },
      unlocked: ['firstFlight', 'ghost', 42],
    }));
    const loaded = localStorageTrophyStorage().load();
    expect(loaded.unlocked).toEqual(['firstFlight']);
    expect(loaded.stats).toEqual({
      gamesPlayed: 0, totalFood: 5, totalDistance: 0, bestDistance: 10, bestNearMisses: 0, bestScore: 3,
    });
  });
});
