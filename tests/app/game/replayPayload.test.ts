import { describe, it, expect } from 'vitest';
import { buildReplayPayload } from '@app/game/replayPayload';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyReplay } from '@services/replay';

const SEED = 'daily:2026-07-08';

describe('buildReplayPayload', () => {
  it('endless ⇒ null (fora do escopo)', () => {
    const world = simulate({ seed: 'endless:X', trait: 'none' }, buildTimeline(10, () => false));
    expect(buildReplayPayload('endless', 'endless:X', world, buildTimeline(10, () => false), 1)).toBeNull();
  });

  it('daily ⇒ StoredReplay verificável (payload reproduz o hash do mundo final)', () => {
    const timeline = buildTimeline(90, (i) => i % 12 === 0);
    const world = simulate({ seed: SEED, trait: 'none' }, timeline);
    const payload = buildReplayPayload('daily', SEED, world, timeline, 42);
    expect(payload).not.toBeNull();
    expect(payload!.mode).toBe('daily');
    expect(payload!.seed).toBe(SEED);
    expect(payload!.timeline).toEqual(timeline.map((f) => f.flap));
    expect(payload!.finalHash).toBe(hashState(world));
    expect(payload!.achievedAt).toBe(42);
    // integridade ponta-a-ponta: o payload construído é válido
    expect(verifyReplay(payload!).valid).toBe(true);
  });

  it('weekly ⇒ mode weekly', () => {
    const timeline = buildTimeline(30, () => false);
    const world = simulate({ seed: 'weekly:2026-W28', trait: 'none' }, timeline);
    const payload = buildReplayPayload('weekly', 'weekly:2026-W28', world, timeline, 1);
    expect(payload!.mode).toBe('weekly');
  });
});
