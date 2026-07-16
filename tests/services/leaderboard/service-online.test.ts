import { describe, it, expect } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';
import type { OnlineScoreRow } from '@services/online/client';

const flush = () => new Promise((r) => setTimeout(r, 0));
const erow = (playerId: string, score: number): OnlineScoreRow => ({
  playerId, playerName: playerId, playerAvatar: '0', mode: 'endless',
  seed: `s-${playerId}`, score, distance: 0, food: 0, nearMisses: 0, level: 0, createdAt: 0,
});

describe('LeaderboardService online-aware', () => {
  it('sem adapter ⇒ central vazio, comportamento local intacto', () => {
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage());
    svc.recordMatch({ mode: 'endless', seed: 's', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2, achievedAt: 1 });
    expect(svc.endless.value).toHaveLength(1);
    expect(svc.centralEndless.value).toHaveLength(0);
    expect(svc.centralAvailable.value).toBe(false);
  });

  it('online já ativo ⇒ init faz refreshCentral', async () => {
    const online = memoryLeaderboardOnline({ online: true, rows: { endless: [erow('a', 9), erow('b', 4)] } });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    expect(svc.centralAvailable.value).toBe(true);
    expect(svc.centralEndless.value.map((e) => e.playerId)).toEqual(['a', 'b']);
  });

  it('online-flip dispara refreshCentral', async () => {
    const online = memoryLeaderboardOnline({ online: false, rows: { endless: [erow('a', 3)] } });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    expect(svc.centralEndless.value).toHaveLength(0);
    online.setOnline(true);
    await flush();
    expect(svc.centralEndless.value).toHaveLength(1);
  });

  it('recordMatch online submete o resultado', async () => {
    const online = memoryLeaderboardOnline({ online: true });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    svc.recordMatch({ mode: 'endless', seed: 's', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2, achievedAt: 1 });
    await flush();
    expect(online.submitted).toHaveLength(1);
    expect(online.submitted[0]?.score).toBe(10);
  });

  it('offline ⇒ recordMatch não submete', async () => {
    const online = memoryLeaderboardOnline({ online: false });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    svc.recordMatch({ mode: 'endless', seed: 's', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2, achievedAt: 1 });
    await flush();
    expect(online.submitted).toHaveLength(0);
  });
});
