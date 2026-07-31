import { describe, it, expect } from 'vitest';
import {
  emptyStats,
  initialTrophyState,
  foldMatch,
  foldPodium,
  epochDay,
  evaluate,
  recordMatch,
  type MatchSummary,
} from '@services/trophy/store';
import { TROPHY_CATALOG, trophyById } from '@services/trophy/catalog';

const match = (m: Partial<MatchSummary>): MatchSummary => ({
  distance: 0, food: 0, nearMisses: 0, score: 0,
  level: 1, coins: 0, powerups: 0, mode: 'endless', playedAt: 0,
  ...m,
});

describe('foldMatch', () => {
  it('incrementa cumulativos e faz max dos melhores', () => {
    const s0 = emptyStats();
    const s1 = foldMatch(s0, match({ distance: 120.9, food: 3, nearMisses: 2, score: 45.7 }));
    expect(s1).toEqual({
      gamesPlayed: 1, totalFood: 3, totalDistance: 120,
      bestDistance: 120, bestNearMisses: 2, bestScore: 45,
      bestLevel: 1, totalNearMisses: 2, totalPowerups: 0, totalCoins: 0,
      challengesPlayed: 0, dailyPodiums: 0, weeklyPodiums: 0, bestChallengeScore: 0,
      daysPlayed: 1, lastPlayDay: 0,
    });
    const s2 = foldMatch(s1, match({ distance: 50, food: 10, nearMisses: 5, score: 20 }));
    expect(s2).toEqual({
      gamesPlayed: 2, totalFood: 13, totalDistance: 170,
      bestDistance: 120, bestNearMisses: 5, bestScore: 45,
      bestLevel: 1, totalNearMisses: 7, totalPowerups: 0, totalCoins: 0,
      challengesPlayed: 0, dailyPodiums: 0, weeklyPodiums: 0, bestChallengeScore: 0,
      daysPlayed: 1, lastPlayDay: 0,
    });
  });

  it('saneia entradas inválidas (NaN/negativo ⇒ 0) e não muta a entrada', () => {
    const s0 = emptyStats();
    const s1 = foldMatch(s0, match({ distance: NaN, food: -4, nearMisses: -1, score: -9 }));
    expect(s1).toEqual({
      gamesPlayed: 1, totalFood: 0, totalDistance: 0,
      bestDistance: 0, bestNearMisses: 0, bestScore: 0,
      bestLevel: 1, totalNearMisses: 0, totalPowerups: 0, totalCoins: 0,
      challengesPlayed: 0, dailyPodiums: 0, weeklyPodiums: 0, bestChallengeScore: 0,
      daysPlayed: 1, lastPlayDay: 0,
    });
    expect(s0).toEqual(emptyStats());
  });
});

describe('foldMatch — campos do 10.7', () => {
  it('bestLevel é o máximo; totalNearMisses/totalPowerups/totalCoins somam', () => {
    let s = emptyStats();
    s = foldMatch(s, match({ level: 4, nearMisses: 3, powerups: 2, coins: 7 }));
    s = foldMatch(s, match({ level: 2, nearMisses: 5, powerups: 1, coins: 3 }));
    expect(s.bestLevel).toBe(4);
    expect(s.totalNearMisses).toBe(8);
    expect(s.totalPowerups).toBe(3);
    expect(s.totalCoins).toBe(10);
  });

  it('modo endless não mexe em challengesPlayed nem bestChallengeScore', () => {
    const s = foldMatch(emptyStats(), match({ mode: 'endless', score: 9999 }));
    expect(s.challengesPlayed).toBe(0);
    expect(s.bestChallengeScore).toBe(0);
    expect(s.bestScore).toBe(9999); // o best geral continua contando
  });

  it('daily e weekly contam como desafio e alimentam bestChallengeScore', () => {
    let s = foldMatch(emptyStats(), match({ mode: 'daily', score: 300 }));
    s = foldMatch(s, match({ mode: 'weekly', score: 1200 }));
    s = foldMatch(s, match({ mode: 'weekly', score: 500 }));
    expect(s.challengesPlayed).toBe(3);
    expect(s.bestChallengeScore).toBe(1200);
  });

  it('daysPlayed conta dias UTC distintos, não partidas', () => {
    const DAY = 86_400_000;
    let s = emptyStats();
    s = foldMatch(s, match({ playedAt: 10 * DAY + 1 }));
    s = foldMatch(s, match({ playedAt: 10 * DAY + 3600_000 })); // mesmo dia
    expect(s.daysPlayed).toBe(1);
    s = foldMatch(s, match({ playedAt: 11 * DAY }));
    expect(s.daysPlayed).toBe(2);
    expect(s.lastPlayDay).toBe(11);
  });

  it('relógio andando para trás não decrementa nem duplica daysPlayed', () => {
    const DAY = 86_400_000;
    let s = foldMatch(emptyStats(), match({ playedAt: 20 * DAY }));
    s = foldMatch(s, match({ playedAt: 5 * DAY }));
    expect(s.daysPlayed).toBe(1);
    expect(s.lastPlayDay).toBe(20);
  });

  it('a primeira partida sempre conta um dia (mesmo com playedAt 0)', () => {
    const s = foldMatch(emptyStats(), match({ playedAt: 0 }));
    expect(s.daysPlayed).toBe(1);
  });

  it('saneia os campos novos (NaN/negativo ⇒ 0)', () => {
    const s = foldMatch(emptyStats(), match({ level: NaN, coins: -5, powerups: -1 }));
    expect(s.bestLevel).toBe(0);
    expect(s.totalCoins).toBe(0);
    expect(s.totalPowerups).toBe(0);
  });
});

describe('foldPodium', () => {
  it('incrementa só o contador do modo pedido', () => {
    const s = foldPodium(emptyStats(), 'daily');
    expect(s.dailyPodiums).toBe(1);
    expect(s.weeklyPodiums).toBe(0);
    expect(foldPodium(s, 'weekly').weeklyPodiums).toBe(1);
  });

  it('não muta a entrada', () => {
    const s0 = emptyStats();
    foldPodium(s0, 'daily');
    expect(s0.dailyPodiums).toBe(0);
  });
});

describe('recordMatch — pódios', () => {
  it('rank dentro do pódio dobra o contador do modo', () => {
    const r = recordMatch(initialTrophyState(), match({ mode: 'weekly' }), { weeklyRank: 2 });
    expect(r.state.stats.weeklyPodiums).toBe(1);
    expect(r.state.stats.dailyPodiums).toBe(0);
  });

  it('rank fora do pódio não dobra nada', () => {
    const r = recordMatch(initialTrophyState(), match({ mode: 'daily' }), { dailyRank: 9 });
    expect(r.state.stats.dailyPodiums).toBe(0);
  });

  it('sem rank informado não dobra pódio', () => {
    const r = recordMatch(initialTrophyState(), match({ mode: 'daily' }));
    expect(r.state.stats.dailyPodiums).toBe(0);
  });
});

describe('epochDay', () => {
  it('converte ms para dia UTC e satura negativo em 0', () => {
    expect(epochDay(0)).toBe(0);
    expect(epochDay(86_400_000)).toBe(1);
    expect(epochDay(86_400_000 * 3 + 999)).toBe(3);
    expect(epochDay(-5)).toBe(0);
    expect(epochDay(NaN)).toBe(0);
  });
});

describe('evaluate', () => {
  it('desbloqueia firstFlight após a 1ª partida e é idempotente', () => {
    const st = { stats: foldMatch(emptyStats(), match({})), unlocked: [] };
    const r1 = evaluate(st, { stats: st.stats });
    expect(r1.newlyUnlocked).toEqual(['firstFlight']);
    expect(r1.state.unlocked).toContain('firstFlight');
    const r2 = evaluate(r1.state, { stats: r1.state.stats });
    expect(r2.newlyUnlocked).toEqual([]);
    expect(r2.state).toBe(r1.state); // mesmo objeto quando nada muda
  });

  it('não desbloqueia conquista cuja condição ainda não bate', () => {
    const st = { stats: emptyStats(), unlocked: [] };
    expect(evaluate(st, { stats: st.stats }).newlyUnlocked).toEqual([]);
  });
});

describe('recordMatch', () => {
  it('destrava centurion quando bestDistance cruza 1000', () => {
    let st = initialTrophyState();
    st = recordMatch(st, match({ distance: 999 })).state;
    expect(st.unlocked).not.toContain('centurion');
    const r = recordMatch(st, match({ distance: 1000 }));
    expect(r.newlyUnlocked).toContain('centurion');
    expect(r.state.unlocked).toContain('centurion');
  });

  it('destrava persistent na 25ª partida', () => {
    let st = initialTrophyState();
    for (let i = 0; i < 24; i++) st = recordMatch(st, match({})).state;
    expect(st.unlocked).not.toContain('persistent');
    const r = recordMatch(st, match({}));
    expect(r.newlyUnlocked).toContain('persistent');
  });
});

describe('dailyPodium (troféu por contexto)', () => {
  it('desbloqueia quando dailyRank ≤ 3', () => {
    for (const rank of [1, 2, 3]) {
      const r = recordMatch(initialTrophyState(), match({}), { dailyRank: rank });
      expect(r.newlyUnlocked).toContain('dailyPodium');
      expect(r.state.unlocked).toContain('dailyPodium');
    }
  });

  it('NÃO desbloqueia com dailyRank ≥ 4 nem sem contexto de rank', () => {
    expect(recordMatch(initialTrophyState(), match({}), { dailyRank: 4 }).newlyUnlocked)
      .not.toContain('dailyPodium');
    expect(recordMatch(initialTrophyState(), match({})).newlyUnlocked)
      .not.toContain('dailyPodium');
  });

  it('é idempotente (nenhum troféu novo quando já desbloqueado e nada mais muda)', () => {
    const first = recordMatch(initialTrophyState(), match({}), { dailyRank: 1 });
    // firstFlight também destrava na 1ª; jogar de novo top-3 não muda unlocked.
    // Nota: recordMatch sempre dobra stats (gamesPlayed++, invariante documentada em
    // index.ts: "stats sempre mudam ⇒ sempre persiste"), então o `state` como um todo
    // NUNCA é a mesma referência entre duas chamadas — a idempotência real observável é
    // que a lista `unlocked` não ganha nada novo.
    const second = recordMatch(first.state, match({}), { dailyRank: 1 });
    expect(second.newlyUnlocked).toEqual([]);
    expect(second.state.unlocked).toEqual(first.state.unlocked);
  });
});

describe('catálogo', () => {
  it('tem ids únicos e trophyById resolve/rejeita', () => {
    const ids = TROPHY_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(trophyById('firstFlight')?.id).toBe('firstFlight');
    expect(trophyById('nope')).toBeUndefined();
  });
});
