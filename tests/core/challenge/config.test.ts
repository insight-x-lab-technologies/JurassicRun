import { describe, it, expect } from 'vitest';
import { challengeWorldConfig } from '@core/challenge';

describe('challengeWorldConfig', () => {
  it('é a config canônica de desafio: seed + trait none + challenge true', () => {
    expect(challengeWorldConfig('daily:2026-01-01')).toEqual({
      seed: 'daily:2026-01-01',
      trait: 'none',
      challenge: true,
    });
  });
});
