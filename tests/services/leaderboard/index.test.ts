import { describe, it, expect } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { initialLeaderboardState, type LeaderboardResult } from '@services/leaderboard/store';

const result = (r: Partial<LeaderboardResult>): LeaderboardResult => ({
  mode: 'endless', seed: 'endless:AAAA', score: 0, distance: 0, food: 0,
  nearMisses: 0, level: 1, achievedAt: 1000, ...r,
});

describe('LeaderboardService', () => {
  it('records into the right signal and persists', () => {
    const storage = memoryLeaderboardStorage();
    const svc = new LeaderboardService();
    svc.init(storage);
    svc.recordMatch(result({ mode: 'daily', seed: 'daily:d', score: 42, level: 3 }));
    expect(svc.daily.value.map((e) => e.score)).toEqual([42]);
    expect(svc.endless.value).toHaveLength(0);
    // persisted
    expect(storage.load().daily.map((e) => e.score)).toEqual([42]);
  });

  it('exposes bestEndlessLevel reactively', () => {
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage());
    svc.recordMatch(result({ level: 6 }));
    expect(svc.bestEndlessLevel.value).toBe(6);
  });

  it('init loads existing state from storage', () => {
    const storage = memoryLeaderboardStorage({
      ...initialLeaderboardState(),
      bestEndlessLevel: 9,
    });
    const svc = new LeaderboardService();
    svc.init(storage);
    expect(svc.bestEndlessLevel.value).toBe(9);
  });

  it('does not persist a no-op periodic record', () => {
    let saves = 0;
    const base = memoryLeaderboardStorage();
    const storage = { load: base.load, save: (s: ReturnType<typeof base.load>) => { saves++; base.save(s); } };
    const svc = new LeaderboardService();
    svc.init(storage);
    svc.recordMatch(result({ mode: 'weekly', seed: 'w', score: 80 }));
    svc.recordMatch(result({ mode: 'weekly', seed: 'w', score: 20 })); // worse ⇒ no-op
    expect(saves).toBe(1);
  });
});
