import { describe, it, expect } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';
import type { OnlineScoreRow } from '@services/online/client';

function row(playerId: string, score: number): OnlineScoreRow {
  return {
    playerId, mode: 'daily', seed: 'daily:2026-07-16', score,
    distance: 0, food: 0, nearMisses: 0, level: 1,
    playerName: playerId, playerAvatar: '0', createdAt: 1000,
  };
}
const result = {
  mode: 'daily' as const, seed: 'daily:2026-07-16', score: 500,
  distance: 100, food: 5, nearMisses: 1, level: 2, achievedAt: 2000,
};

describe('centralDailyRank', () => {
  it('rank 1 quando meu score é o maior (inclui o sintético mesmo sem estar no servidor)', async () => {
    const online = memoryLeaderboardOnline({
      online: true, playerId: 'me',
      rows: { daily: [row('a', 300), row('b', 400)] },
      seeds: { daily: 'daily:2026-07-16', weekly: 'weekly:x' },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBe(1);
  });

  it('rank 3 atrás de dois scores maiores', async () => {
    const online = memoryLeaderboardOnline({
      online: true, playerId: 'me',
      rows: { daily: [row('a', 900), row('b', 700)] },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBe(3); // me=500
  });

  it('undefined offline', async () => {
    const online = memoryLeaderboardOnline({ online: false, playerId: 'me' });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBeUndefined();
  });

  it('undefined sem playerId', async () => {
    const online = memoryLeaderboardOnline({ online: true, playerId: null });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBeUndefined();
  });
});
