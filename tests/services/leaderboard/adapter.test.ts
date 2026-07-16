import { describe, it, expect } from 'vitest';
import { createLeaderboardOnline } from '../../../src/app/online/leaderboardAdapter';

describe('createLeaderboardOnline', () => {
  it('mapeia LeaderboardResult → submitScore do onlineService (sem playerId)', async () => {
    const calls: unknown[] = [];
    const fakeOnline = {
      online: { value: true },
      submitScore: async (i: unknown) => { calls.push(i); },
      fetchScores: async () => [],
    } as never;
    const adapter = createLeaderboardOnline({
      onlineSvc: fakeOnline,
      dailySeed: () => 'daily:D', weeklySeed: () => 'weekly:W',
    });
    await adapter.submitScore({ mode: 'endless', seed: 's', score: 7, distance: 3, food: 1, nearMisses: 0, level: 2, achievedAt: 0 });
    expect(calls[0]).toMatchObject({ mode: 'endless', seed: 's', score: 7, nearMisses: 0 });
    expect(adapter.currentSeeds()).toEqual({ daily: 'daily:D', weekly: 'weekly:W' });
  });
});
