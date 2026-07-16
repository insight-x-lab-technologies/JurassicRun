import { describe, expect, it } from 'vitest';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyChallengeSubmission as fromSource, type ChallengeSubmission } from '@services/online/verifyChallenge';
// @ts-expect-error bundle JS gerado sem tipos
import { verifyChallengeSubmission as fromBundle } from '../../supabase/functions/verify-challenge/_verify.bundle.js';

function sample(seed: string): ChallengeSubmission {
  const frames = buildTimeline(400, (i) => i % 3 === 0);
  const w = simulate({ seed, trait: 'none' }, frames);
  return {
    seed, timeline: frames.map((f) => f.flap),
    score: w.score, distance: w.distance, food: w.food, nearMisses: w.nearMisses,
    finalHash: hashState(w),
  };
}

describe('edge bundle é fiel à fonte (guarda de staleness)', () => {
  it('exporta a função de verificação', () => {
    expect(typeof fromBundle).toBe('function');
  });

  it('produz resultado idêntico à fonte em casos fiéis e adulterados', () => {
    const cases: ChallengeSubmission[] = [
      sample('daily:2026-07-16'),
      sample('weekly:2026-W29'),
      { ...sample('daily:2026-07-17'), score: 123456 },        // campo inflado
      { ...sample('daily:2026-07-18'), finalHash: '0'.repeat(32) }, // hash adulterado
    ];
    for (const c of cases) {
      expect(fromBundle(c)).toEqual(fromSource(c));
    }
  });
});
