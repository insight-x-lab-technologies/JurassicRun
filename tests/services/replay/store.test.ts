import { describe, it, expect } from 'vitest';
import {
  initialReplayState,
  recordReplay,
  MAX_REPLAYS,
  type StoredReplay,
} from '@services/replay/store';

function replay(over: Partial<StoredReplay> = {}): StoredReplay {
  return {
    mode: 'daily',
    seed: 'daily:2026-07-08',
    timeline: [true, false, true],
    score: 100,
    distance: 50,
    food: 3,
    nearMisses: 1,
    finalHash: 'a'.repeat(32),
    achievedAt: 1000,
    ...over,
  };
}

describe('recordReplay', () => {
  it('estado inicial é vazio nos dois modos', () => {
    const s = initialReplayState();
    expect(s.daily).toEqual([]);
    expect(s.weekly).toEqual([]);
  });

  it('insere um replay no modo certo', () => {
    const s = recordReplay(initialReplayState(), replay());
    expect(s.daily).toHaveLength(1);
    expect(s.weekly).toHaveLength(0);
    expect(s.daily[0]!.seed).toBe('daily:2026-07-08');
  });

  it('dedup por seed: mantém o de maior score', () => {
    let s = recordReplay(initialReplayState(), replay({ score: 100, finalHash: 'x'.repeat(32) }));
    s = recordReplay(s, replay({ score: 250, finalHash: 'y'.repeat(32) }));
    expect(s.daily).toHaveLength(1);
    expect(s.daily[0]!.score).toBe(250);
    expect(s.daily[0]!.finalHash).toBe('y'.repeat(32));
  });

  it('tentativa que não supera o recorde do período ⇒ mesma ref (no-op)', () => {
    const first = recordReplay(initialReplayState(), replay({ score: 250 }));
    const second = recordReplay(first, replay({ score: 100 }));
    expect(second).toBe(first);
  });

  it('trunca a MAX_REPLAYS por modo, mantendo os maiores scores', () => {
    let s = initialReplayState();
    for (let i = 0; i < MAX_REPLAYS + 3; i++) {
      s = recordReplay(s, replay({ seed: `daily:d${i}`, score: i }));
    }
    expect(s.daily).toHaveLength(MAX_REPLAYS);
    const scores = s.daily.map((r) => r.score);
    expect(Math.min(...scores)).toBe(3); // os 3 menores (0,1,2) foram evictados
  });

  it('modos daily e weekly são independentes', () => {
    let s = recordReplay(initialReplayState(), replay({ mode: 'daily', seed: 'daily:x' }));
    s = recordReplay(s, replay({ mode: 'weekly', seed: 'weekly:y' }));
    expect(s.daily).toHaveLength(1);
    expect(s.weekly).toHaveLength(1);
  });

  it('saneia numéricos negativos/NaN para inteiro ≥ 0', () => {
    const s = recordReplay(initialReplayState(), replay({ score: -5, distance: NaN, food: 2.9 }));
    expect(s.daily[0]!.score).toBe(0);
    expect(s.daily[0]!.distance).toBe(0);
    expect(s.daily[0]!.food).toBe(2);
  });
});
