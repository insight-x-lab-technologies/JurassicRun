import { describe, it, expect } from 'vitest';
import { memoryOnlineClient, type OnlineScoreRow } from '@services/online/client';

const row = (o: Partial<OnlineScoreRow> & { playerId: string; score: number; mode: 'endless' | 'daily' | 'weekly'; seed: string }): OnlineScoreRow => ({
  playerName: 'P', playerAvatar: '0', distance: 0, food: 0, nearMisses: 0, level: 0, createdAt: 0, ...o,
});

describe('memoryOnlineClient', () => {
  it('signInAnonymously resolve com o uid e conta chamadas', async () => {
    const c = memoryOnlineClient({ uid: 'uid-1' });
    expect(await c.signInAnonymously()).toBe('uid-1');
    expect(await c.signInAnonymously()).toBe('uid-1');
    expect(c.signInCount).toBe(2);
  });

  it('signInAnonymously rejeita quando failSignIn', async () => {
    const c = memoryOnlineClient({ failSignIn: true });
    await expect(c.signInAnonymously()).rejects.toThrow();
  });

  it('upsertPlayer registra os players enviados', async () => {
    const c = memoryOnlineClient();
    await c.upsertPlayer({ id: 'uid-1', name: 'Rex', avatar: '120' });
    expect(c.upserts).toEqual([{ id: 'uid-1', name: 'Rex', avatar: '120' }]);
  });
});

describe('memoryOnlineClient scores', () => {
  it('grava submits', async () => {
    const c = memoryOnlineClient();
    await c.submitScore({ playerId: 'u1', mode: 'endless', seed: 'endless:A', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2 });
    expect(c.submittedScores).toHaveLength(1);
    expect(c.submittedScores[0]?.score).toBe(10);
  });

  it('fetchScores filtra por mode e seed', async () => {
    const c = memoryOnlineClient({
      scores: [
        row({ playerId: 'a', mode: 'endless', seed: 'endless:A', score: 9 }),
        row({ playerId: 'b', mode: 'daily', seed: 'daily:2026-07-15', score: 7 }),
        row({ playerId: 'c', mode: 'daily', seed: 'daily:2026-07-14', score: 5 }),
      ],
    });
    expect(await c.fetchScores('endless')).toHaveLength(1);
    expect(await c.fetchScores('daily', 'daily:2026-07-15')).toHaveLength(1);
    expect((await c.fetchScores('daily', 'daily:2026-07-15'))[0]?.playerId).toBe('b');
  });
});
