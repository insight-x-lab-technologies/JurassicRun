import { describe, it, expect } from 'vitest';
import {
  emptyStats,
  initialTrophyState,
  foldMatch,
  evaluate,
  recordMatch,
  type MatchSummary,
} from '@services/trophy/store';
import { TROPHY_CATALOG, trophyById } from '@services/trophy/catalog';

const match = (m: Partial<MatchSummary>): MatchSummary => ({
  distance: 0, food: 0, nearMisses: 0, score: 0, ...m,
});

describe('foldMatch', () => {
  it('incrementa cumulativos e faz max dos melhores', () => {
    const s0 = emptyStats();
    const s1 = foldMatch(s0, match({ distance: 120.9, food: 3, nearMisses: 2, score: 45.7 }));
    expect(s1).toEqual({
      gamesPlayed: 1, totalFood: 3, totalDistance: 120,
      bestDistance: 120, bestNearMisses: 2, bestScore: 45,
    });
    const s2 = foldMatch(s1, match({ distance: 50, food: 10, nearMisses: 5, score: 20 }));
    expect(s2).toEqual({
      gamesPlayed: 2, totalFood: 13, totalDistance: 170,
      bestDistance: 120, bestNearMisses: 5, bestScore: 45,
    });
  });

  it('saneia entradas inválidas (NaN/negativo ⇒ 0) e não muta a entrada', () => {
    const s0 = emptyStats();
    const s1 = foldMatch(s0, match({ distance: NaN, food: -4, nearMisses: -1, score: -9 }));
    expect(s1).toEqual({
      gamesPlayed: 1, totalFood: 0, totalDistance: 0,
      bestDistance: 0, bestNearMisses: 0, bestScore: 0,
    });
    expect(s0).toEqual(emptyStats());
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
