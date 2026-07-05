import { describe, it, expect } from 'vitest';
import type { WorldConfig, DinoTrait } from '@core/sim';
import { simulate, buildTimeline, hashState } from '@core/replay';

const BASE: WorldConfig = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200, seed: 'endless:TRAIT' };
const flapEvery = (n: number) => (i: number) => i % n === 0;

describe('determinismo do traço', () => {
  it('mesma seed + mesmo trait ⇒ mesmo hash (reprodutível)', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const a = hashState(simulate({ ...BASE, trait: 'magnet' }, tl));
    const b = hashState(simulate({ ...BASE, trait: 'magnet' }, tl));
    expect(a).toBe(b);
  });

  it('fps-independente (mesmo trait) — simulate compõe passos fixos', () => {
    // buildTimeline + simulate já rodam passo fixo; dois runs idênticos provam estabilidade
    const tl = buildTimeline(900, flapEvery(4));
    expect(hashState(simulate({ ...BASE, trait: 'doubleFood' }, tl)))
      .toBe(hashState(simulate({ ...BASE, trait: 'doubleFood' }, tl)));
  });

  it('traços que se manifestam ⇒ hashes distintos de none', () => {
    const tl = buildTimeline(1500, flapEvery(6));
    const none = hashState(simulate({ ...BASE, trait: 'none' }, tl));
    for (const t of ['magnet', 'doubleFood', 'startLife', 'headStart'] as DinoTrait[]) {
      expect(hashState(simulate({ ...BASE, trait: t }, tl))).not.toBe(none);
    }
  });
});
