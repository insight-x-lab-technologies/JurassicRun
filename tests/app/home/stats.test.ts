import { describe, it, expect, beforeEach } from 'vitest';
import { getHomeStats } from '@app/home/stats';
import { leaderboardService } from '@services/leaderboard';
import { walletService } from '@services/wallet';
import { trophyService } from '@services/trophy';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryWalletStorage } from '@services/wallet/storage';
import { memoryTrophyStorage } from '@services/trophy/storage';

describe('getHomeStats', () => {
  beforeEach(() => {
    walletService.init(memoryWalletStorage());
    trophyService.init(memoryTrophyStorage());
    leaderboardService.init(memoryLeaderboardStorage());
  });

  it('trophies reflete unlockedCount do trophyService reativamente', () => {
    expect(getHomeStats().trophies).toBe(0);
    trophyService.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 });
    expect(getHomeStats().trophies).toBe(1);
  });

  it('maxLevel reflete bestEndlessLevel do leaderboardService', () => {
    expect(getHomeStats().maxLevel).toBe(0);
    leaderboardService.recordMatch({
      mode: 'endless',
      seed: 'endless:Z',
      score: 10,
      distance: 5,
      food: 0,
      nearMisses: 0,
      level: 8,
      achievedAt: 1,
    });
    expect(getHomeStats().maxLevel).toBe(8);
  });
});
