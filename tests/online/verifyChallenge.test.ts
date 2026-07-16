import { describe, expect, it } from 'vitest';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyChallengeSubmission, type ChallengeSubmission } from '@services/online/verifyChallenge';

const SEED = 'daily:2026-07-16';

/** Constrói uma submissão fiel re-simulando de verdade. */
function faithful(seed = SEED): ChallengeSubmission {
  const frames = buildTimeline(600, (i) => i % 3 === 0); // InputFrame[]; pattern é (i)=>boolean
  const world = simulate({ seed, trait: 'none' }, frames);
  return {
    seed,
    timeline: frames.map((f) => f.flap),
    score: world.score,
    distance: world.distance,
    food: world.food,
    nearMisses: world.nearMisses,
    finalHash: hashState(world),
  };
}

describe('verifyChallengeSubmission', () => {
  it('aceita uma submissão fiel', () => {
    const v = verifyChallengeSubmission(faithful());
    expect(v.valid).toBe(true);
    expect(v.hashMatches).toBe(true);
    expect(v.fieldsMatch).toBe(true);
  });

  it('rejeita hash adulterado (timeline não bate)', () => {
    const v = verifyChallengeSubmission({ ...faithful(), finalHash: 'deadbeef'.repeat(4) });
    expect(v.hashMatches).toBe(false);
    expect(v.valid).toBe(false);
  });

  it('rejeita coluna de score inflada mesmo com hash correto', () => {
    const base = faithful();
    const v = verifyChallengeSubmission({ ...base, score: base.score + 9999 });
    expect(v.hashMatches).toBe(true);   // hash é da re-sim, não das colunas
    expect(v.fieldsMatch).toBe(false);
    expect(v.valid).toBe(false);
  });

  it('rejeita timeline divergente (leva a outro estado final)', () => {
    const base = faithful();
    const tampered = base.timeline.map((flap, i) => (i < 100 ? !flap : flap)); // invert first 100 steps
    const v = verifyChallengeSubmission({ ...base, timeline: tampered });
    expect(v.valid).toBe(false); // hash e/ou campos divergem
  });

  it('expectedHash é o hash da re-sim (determinístico)', () => {
    const s = faithful();
    expect(verifyChallengeSubmission(s).expectedHash).toBe(s.finalHash);
  });
});
