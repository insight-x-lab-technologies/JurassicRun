import { describe, it, expect } from 'vitest';
import { simulate, buildTimeline, hashState } from '@core/replay';
import { challengeWorldConfig } from '@core/challenge';
import { verifyReplay } from '@services/replay';
import { verifyChallengeSubmission } from '@services/online/verifyChallenge';

const SEED = 'daily:2026-03-03';
const FLAPS: readonly boolean[] = Array.from({ length: 900 }, (_, i) => i % 6 === 0);
const TL = buildTimeline(FLAPS.length, (i) => FLAPS[i] === true);
const FINAL = simulate(challengeWorldConfig(SEED), TL);

describe('verificadores usam a config de desafio (com modificadores)', () => {
  it('verifyReplay valida um replay simulado em modo desafio', () => {
    const v = verifyReplay({
      mode: 'daily',
      seed: SEED,
      timeline: [...FLAPS],
      finalHash: hashState(FINAL),
      score: FINAL.score,
      distance: FINAL.distance,
      food: FINAL.food,
      nearMisses: FINAL.nearMisses,
      achievedAt: 0,
    });
    expect(v.valid).toBe(true);
  });

  it('verifyReplay rejeita hash de simulação SEM modificadores', () => {
    const noMods = hashState(simulate({ seed: SEED, trait: 'none' }, TL));
    const v = verifyReplay({
      mode: 'daily',
      seed: SEED,
      timeline: [...FLAPS],
      finalHash: noMods,
      score: FINAL.score,
      distance: FINAL.distance,
      food: FINAL.food,
      nearMisses: FINAL.nearMisses,
      achievedAt: 0,
    });
    expect(v.valid).toBe(false);
  });

  it('verifyChallengeSubmission concorda com verifyReplay', () => {
    const v = verifyChallengeSubmission({
      seed: SEED,
      timeline: [...FLAPS],
      finalHash: hashState(FINAL),
      score: FINAL.score,
      distance: FINAL.distance,
      food: FINAL.food,
      nearMisses: FINAL.nearMisses,
    });
    expect(v.valid).toBe(true);
  });
});
