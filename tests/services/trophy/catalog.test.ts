import { describe, it, expect } from 'vitest';
import { TROPHY_CATALOG, trophyById, isKnownTrophyId } from '@services/trophy/catalog';
import { emptyStats, type TrophyStats, type TrophyEvalContext } from '@services/trophy/store';

/** `Record<string, number>` (e não `Partial<TrophyStats>`) porque os testes montam o override
 *  com chave computada — o TS tipa `{ [field]: n }` como índice string. */
const ctx = (stats: Record<string, number>, extra: Omit<TrophyEvalContext, 'stats'> = {}):
  TrophyEvalContext => ({ stats: { ...emptyStats(), ...stats } as TrophyStats, ...extra });

/** Cada troféu novo: o campo do agregado que o alimenta e o limiar. */
const THRESHOLDS: ReadonlyArray<readonly [string, keyof TrophyStats & string, number]> = [
  ['explorer', 'bestLevel', 5],
  ['skyLord', 'bestLevel', 10],
  ['globetrotter', 'totalDistance', 50_000],
  ['veteran', 'gamesPlayed', 100],
  ['stuntPilot', 'bestNearMisses', 25],
  ['closeShave', 'totalNearMisses', 250],
  ['treasurer', 'totalCoins', 500],
  ['tycoon', 'totalCoins', 5_000],
  ['empowered', 'totalPowerups', 25],
  ['powerHungry', 'totalPowerups', 200],
  ['challenger', 'challengesPlayed', 10],
  ['challengeAce', 'bestChallengeScore', 5_000],
  ['weeklyPodium', 'weeklyPodiums', 1],
  ['dedicated', 'daysPlayed', 7],
  ['legend', 'bestScore', 20_000],
];

describe('catálogo 10.7', () => {
  it('tem 23 troféus, todos com id único', () => {
    expect(TROPHY_CATALOG.length).toBe(23);
    expect(new Set(TROPHY_CATALOG.map((t) => t.id)).size).toBe(23);
  });

  it('todo troféu tem nameKey/descKey no padrão trophy.<id>.*', () => {
    for (const t of TROPHY_CATALOG) {
      expect(t.nameKey).toBe(`trophy.${t.id}.name`);
      expect(t.descKey).toBe(`trophy.${t.id}.desc`);
    }
  });

  it('os 8 troféus originais continuam no catálogo (nenhum desbloqueio antigo vira órfão)', () => {
    for (const id of ['firstFlight', 'centurion', 'forager', 'daredevil', 'marathoner',
                      'highRoller', 'persistent', 'dailyPodium']) {
      expect(isKnownTrophyId(id)).toBe(true);
    }
  });

  it('cada troféu novo: abaixo do limiar não desbloqueia, no limiar e acima sim', () => {
    for (const [id, field, threshold] of THRESHOLDS) {
      const def = trophyById(id);
      expect(def, id).toBeDefined();
      expect(def!.condition(ctx({ [field]: threshold - 1 })), `${id} abaixo`).toBe(false);
      expect(def!.condition(ctx({ [field]: threshold })), `${id} no limiar`).toBe(true);
      expect(def!.condition(ctx({ [field]: threshold * 2 })), `${id} acima`).toBe(true);
    }
  });

  it('nenhum troféu novo desbloqueia com o agregado zerado', () => {
    const zero = ctx({});
    for (const [id] of THRESHOLDS) {
      expect(trophyById(id)!.condition(zero), id).toBe(false);
    }
  });
});
