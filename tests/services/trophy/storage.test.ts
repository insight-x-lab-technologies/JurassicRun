// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { localStorageTrophyStorage, memoryTrophyStorage, STORAGE_KEY } from '@services/trophy/storage';
import { emptyStats, initialTrophyState, type TrophyState } from '@services/trophy/store';
import { LEGACY_STORAGE_KEYS } from '@services/storage/legacy';

const sample: TrophyState = {
  stats: {
    gamesPlayed: 3, totalFood: 12, totalDistance: 900, bestDistance: 400,
    bestNearMisses: 4, bestScore: 88,
    bestLevel: 2, totalNearMisses: 9, totalPowerups: 5, totalCoins: 12,
    challengesPlayed: 1, dailyPodiums: 1, weeklyPodiums: 0, bestChallengeScore: 70,
    daysPlayed: 2, lastPlayDay: 20_500,
  },
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
      ...emptyStats(),
      gamesPlayed: 0, totalFood: 5, totalDistance: 0, bestDistance: 10, bestNearMisses: 0, bestScore: 3,
    });
  });
});

const sampleV1Payload = {
  version: 1,
  stats: {
    gamesPlayed: 40, totalFood: 300, totalDistance: 22000,
    bestDistance: 1500, bestNearMisses: 12, bestScore: 6000,
  },
  unlocked: ['firstFlight', 'centurion', 'persistent'],
};

describe('migração v1 → v2', () => {
  beforeEach(() => localStorage.clear());

  it('payload v1 carrega preservando os desbloqueios e zerando os campos novos', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleV1Payload));
    const loaded = localStorageTrophyStorage().load();
    expect(loaded.unlocked).toEqual(['firstFlight', 'centurion', 'persistent']);
    expect(loaded.stats.gamesPlayed).toBe(40);
    expect(loaded.stats.bestScore).toBe(6000);
    expect(loaded.stats.bestLevel).toBe(0);
    expect(loaded.stats.totalPowerups).toBe(0);
    expect(loaded.stats.daysPlayed).toBe(0);
    expect(loaded.stats.lastPlayDay).toBe(0);
  });

  it('a CHAVE não muda — bumpar a chave apagaria os desbloqueios', () => {
    expect(STORAGE_KEY).toBe('jurassicrun.trophies.v1');
  });

  it('grava version 2', () => {
    localStorageTrophyStorage().save(sample);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { version: number };
    expect(raw.version).toBe(2);
  });

  it('a chave de troféus NÃO está na lista de chaves legadas a purgar', () => {
    expect([...LEGACY_STORAGE_KEYS]).not.toContain(STORAGE_KEY);
  });
});

describe('invariante de saneamento', () => {
  it('todo campo de TrophyStats é saneado na leitura (nenhum vira undefined)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, stats: {}, unlocked: [] }));
    const loaded = localStorageTrophyStorage().load();
    for (const [k, v] of Object.entries(loaded.stats)) {
      expect(typeof v, `campo ${k}`).toBe('number');
      expect(Number.isInteger(v), `campo ${k}`).toBe(true);
    }
    // e o conjunto de campos bate exatamente com o do estado vazio
    expect(Object.keys(loaded.stats).sort()).toEqual(Object.keys(emptyStats()).sort());
  });
});
