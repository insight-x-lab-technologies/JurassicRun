import { describe, it, expect } from 'vitest';
import { getHomeStats } from '@app/home/stats';

describe('getHomeStats', () => {
  it('retorna placeholders enquanto as fontes (4.5/4.7) não existem', () => {
    expect(getHomeStats()).toEqual({ coins: 0, trophies: 0, maxLevel: 1 });
  });
});
