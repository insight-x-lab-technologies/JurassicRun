import { describe, it, expect } from 'vitest';
import { formatGameOverStats } from '@render/gameover';

describe('formatGameOverStats', () => {
  it('faz floor de distância/comida/near-misses em strings', () => {
    expect(formatGameOverStats({ distance: 128.9, food: 7, nearMisses: 3 })).toEqual({
      distance: '128',
      food: '7',
      nearMisses: '3',
    });
  });

  it('formata zeros e trunca frações', () => {
    expect(formatGameOverStats({ distance: 0.9, food: 0, nearMisses: 2.7 })).toEqual({
      distance: '0',
      food: '0',
      nearMisses: '2',
    });
  });
});
