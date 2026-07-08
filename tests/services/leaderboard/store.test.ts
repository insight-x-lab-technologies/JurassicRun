import { describe, it, expect } from 'vitest';
import {
  initialLeaderboardState,
  recordMatch,
  sanitizeStat,
  rankOf,
  MAX_ENTRIES,
  type LeaderboardResult,
  type LeaderboardState,
} from '@services/leaderboard/store';

const result = (r: Partial<LeaderboardResult>): LeaderboardResult => ({
  mode: 'endless', seed: 'endless:AAAA', score: 0, distance: 0, food: 0,
  nearMisses: 0, level: 1, achievedAt: 1000, ...r,
});

describe('sanitizeStat', () => {
  it('floors to non-negative integer; NaN/negative/Infinity ⇒ 0', () => {
    expect(sanitizeStat(120.9)).toBe(120);
    expect(sanitizeStat(-4)).toBe(0);
    expect(sanitizeStat(NaN)).toBe(0);
    expect(sanitizeStat(Infinity)).toBe(0);
  });
});

describe('recordMatch — endless', () => {
  it('inserts and ranks by score desc (tie: achievedAt asc)', () => {
    let s: LeaderboardState = initialLeaderboardState();
    s = recordMatch(s, result({ seed: 'a', score: 10, achievedAt: 1 }));
    s = recordMatch(s, result({ seed: 'b', score: 30, achievedAt: 2 }));
    s = recordMatch(s, result({ seed: 'c', score: 30, achievedAt: 1 })); // tie, earlier wins
    expect(s.endless.map((e) => e.seed)).toEqual(['c', 'b', 'a']);
  });

  it('floors stored numbers', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ score: 45.9, distance: 120.7, food: 3, nearMisses: 2 }));
    expect(s.endless[0]).toMatchObject({ score: 45, distance: 120, food: 3, nearMisses: 2 });
  });

  it('keeps only the top MAX_ENTRIES', () => {
    let s = initialLeaderboardState();
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      s = recordMatch(s, result({ seed: `s${i}`, score: i, achievedAt: i }));
    }
    expect(s.endless).toHaveLength(MAX_ENTRIES);
    expect(s.endless[0]?.score).toBe(MAX_ENTRIES + 4); // highest
    expect(s.endless.at(-1)?.score).toBe(5); // lowest surviving
  });

  it('tracks bestEndlessLevel (max, lifetime, never evicted)', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ score: 5, level: 7 }));
    s = recordMatch(s, result({ score: 999, level: 3 }));
    expect(s.bestEndlessLevel).toBe(7);
  });
});

describe('recordMatch — daily/weekly dedup by seed', () => {
  it('keeps only the best score per seed (period)', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-07', score: 20, achievedAt: 1 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-07', score: 50, achievedAt: 2 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-08', score: 30, achievedAt: 3 }));
    expect(s.daily.map((e) => [e.seed, e.score])).toEqual([
      ['daily:2026-07-07', 50],
      ['daily:2026-07-08', 30],
    ]);
  });

  it('a worse attempt for an existing period returns the SAME state object', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'weekly', seed: 'weekly:2026-W28', score: 80 }));
    const before = s;
    const after = recordMatch(s, result({ mode: 'weekly', seed: 'weekly:2026-W28', score: 40 }));
    expect(after).toBe(before);
  });

  it('does not cross-contaminate modes', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'daily', seed: 'd', score: 10 }));
    expect(s.endless).toHaveLength(0);
    expect(s.weekly).toHaveLength(0);
    expect(s.daily).toHaveLength(1);
  });
});

describe('rankOf', () => {
  it('retorna a posição 1-based na lista diária ranqueada por score', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-05', score: 10 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-06', score: 30 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-07', score: 20 }));
    // ranqueado: 07-06 (30) > 07-07 (20) > 07-05 (10)
    expect(rankOf(s.daily, 'daily:2026-07-06')).toBe(1);
    expect(rankOf(s.daily, 'daily:2026-07-07')).toBe(2);
    expect(rankOf(s.daily, 'daily:2026-07-05')).toBe(3);
  });

  it('retorna undefined para seed ausente', () => {
    const s = initialLeaderboardState();
    expect(rankOf(s.daily, 'daily:nope')).toBeUndefined();
  });
});
