import { describe, it, expect } from 'vitest';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyReplay } from '@services/replay/verify';
import type { StoredReplay } from '@services/replay/store';

const SEED = 'daily:2026-07-08';

/** Constrói um StoredReplay honesto: simula {seed, trait:'none'} + timeline e ancora o hash. */
function honestReplay(): StoredReplay {
  const timeline = buildTimeline(300, (i) => i % 20 === 0); // flap menos frequente
  const world = simulate({ seed: SEED, trait: 'none' }, timeline);
  return {
    mode: 'daily',
    seed: SEED,
    timeline: timeline.map((f) => f.flap),
    score: Math.floor(world.score),
    distance: Math.floor(world.distance),
    food: world.food,
    nearMisses: world.nearMisses,
    finalHash: hashState(world),
    achievedAt: 1000,
  };
}

describe('verifyReplay', () => {
  it('replay honesto ⇒ valid=true e hashes iguais', () => {
    const r = honestReplay();
    const v = verifyReplay(r);
    expect(v.valid).toBe(true);
    expect(v.actualHash).toBe(v.expectedHash);
    expect(v.actualHash).toBe(r.finalHash);
  });

  it('timeline adulterada (um flap virado) ⇒ valid=false', () => {
    const r = honestReplay();
    // Cria timeline com padrão oposto (sem flap onde había flap, flap onde não havia)
    const tampered: boolean[] = [];
    for (let i = 0; i < r.timeline.length; i++) {
      tampered.push(!r.timeline[i]); // inverte cada flap
    }
    const v = verifyReplay({ ...r, timeline: tampered });
    expect(v.valid).toBe(false);
    expect(v.actualHash).not.toBe(v.expectedHash);
  });

  it('seed trocada ⇒ valid=false (hash gravado não corresponde à nova seed)', () => {
    const r = honestReplay();
    const v = verifyReplay({ ...r, seed: 'daily:2020-01-01' });
    expect(v.valid).toBe(false);
  });

  it('hash final adulterado ⇒ valid=false', () => {
    const r = honestReplay();
    const v = verifyReplay({ ...r, finalHash: 'f'.repeat(32) });
    expect(v.valid).toBe(false);
    expect(v.expectedHash).toBe('f'.repeat(32));
  });
});
