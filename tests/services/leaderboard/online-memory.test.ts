import { describe, it, expect } from 'vitest';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';

describe('memoryLeaderboardOnline', () => {
  it('online configurável e grava submits', async () => {
    const m = memoryLeaderboardOnline({ online: true });
    expect(m.online.value).toBe(true);
    await m.submitScore({ mode: 'endless', seed: 's', score: 1, distance: 1, food: 0, nearMisses: 0, level: 0, achievedAt: 0 });
    expect(m.submitted).toHaveLength(1);
  });

  it('setOnline alterna o sinal', () => {
    const m = memoryLeaderboardOnline({ online: false });
    m.setOnline(true);
    expect(m.online.value).toBe(true);
  });

  it('fetchScores devolve rows por modo', async () => {
    const m = memoryLeaderboardOnline({
      online: true,
      rows: { endless: [{ playerId: 'a', playerName: 'A', playerAvatar: '0', mode: 'endless', seed: 's', score: 3, distance: 0, food: 0, nearMisses: 0, level: 0, createdAt: 0 }] },
    });
    expect(await m.fetchScores('endless')).toHaveLength(1);
    expect(await m.fetchScores('daily')).toHaveLength(0);
  });
});
