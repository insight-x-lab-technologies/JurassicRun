import { describe, it, expect } from 'vitest';
import { getHomeStats } from '@app/home/stats';
import { trophyService } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';

describe('getHomeStats', () => {
  it('retorna placeholders para maxLevel (Fase 5); coins/trophies vêm dos serviços reais', () => {
    expect(getHomeStats()).toEqual({ coins: 0, trophies: 0, maxLevel: 1 });
  });

  it('trophies reflete unlockedCount do trophyService reativamente', () => {
    trophyService.init(memoryTrophyStorage());
    expect(getHomeStats().trophies).toBe(0);
    trophyService.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 });
    expect(getHomeStats().trophies).toBe(1);
  });
});
