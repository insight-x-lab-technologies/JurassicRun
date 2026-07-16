import { describe, expect, it } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';
import type { OnlineScoreRow } from '@services/online/client';

const flush = () => new Promise((r) => setTimeout(r, 0));

const seed = 'daily:2026-07-16';
const row = (playerId: string, score: number): OnlineScoreRow => ({
  playerId, mode: 'daily', seed, score, distance: 0, food: 0, nearMisses: 0, level: 1,
  playerName: playerId, playerAvatar: '0', createdAt: 1,
});

describe('LeaderboardService marca entradas centrais verificadas', () => {
  it('daily: verified=true só p/ jogadores no conjunto verificado', async () => {
    const online = memoryLeaderboardOnline({
      online: true,
      rows: { daily: [row('a', 50), row('b', 40)] },
      seeds: { daily: seed, weekly: 'weekly:x' },
      verified: { daily: ['a'] },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    const central = svc.centralDaily.value;
    expect(central.find((e) => e.playerId === 'a')?.verified).toBe(true);
    expect(central.find((e) => e.playerId === 'b')?.verified).toBe(false);
  });

  it('endless: sempre verified=false (sem replay)', async () => {
    const online = memoryLeaderboardOnline({
      online: true, rows: { endless: [row('a', 50)] },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    expect(svc.centralEndless.value[0]?.verified).toBe(false);
  });
});
