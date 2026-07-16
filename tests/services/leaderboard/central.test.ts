import { describe, it, expect } from 'vitest';
import { toCentralEntries } from '@services/leaderboard/central';
import type { OnlineScoreRow } from '@services/online/client';

const row = (playerId: string, score: number, extra: Partial<OnlineScoreRow> = {}): OnlineScoreRow => ({
  playerId, playerName: playerId.toUpperCase(), playerAvatar: '0',
  mode: 'endless', seed: `s-${playerId}-${score}`, score,
  distance: score, food: 0, nearMisses: 0, level: 0, createdAt: 0, ...extra,
});

describe('toCentralEntries', () => {
  it('ordena por score desc', () => {
    const out = toCentralEntries([row('a', 5), row('b', 9), row('c', 7)]);
    expect(out.map((e) => e.playerId)).toEqual(['b', 'c', 'a']);
  });

  it('dedup por jogador mantendo o melhor score', () => {
    const out = toCentralEntries([row('a', 5), row('a', 12), row('b', 9)]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ playerId: 'a', score: 12 });
  });

  it('corta em maxEntries', () => {
    const rows = Array.from({ length: 15 }, (_, i) => row(`p${i}`, i));
    expect(toCentralEntries(rows, 10)).toHaveLength(10);
  });

  it('saneia números negativos/NaN para 0', () => {
    const out = toCentralEntries([row('a', Number.NaN, { distance: -3 })]);
    expect(out[0]).toMatchObject({ score: 0, distance: 0 });
  });
});
