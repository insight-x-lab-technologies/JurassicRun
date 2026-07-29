import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { boundsOf } from '@core/sim';
import type { Entity } from '@core/sim';
import { SpawnGenerator, COLLECTIBLE_CATALOG, DEFAULT_COLLECTIBLE_CONFIG } from '@core/spawn';

function gen(seed = 'col-test'): SpawnGenerator {
  return new SpawnGenerator(createRng(seed).fork('collectibles'), DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG, 'collectible');
}

describe('geração de coletáveis', () => {
  it('emite coletáveis com type/tag corretos, x crescente e ids 0..n', () => {
    const out: Entity[] = [];
    gen().generateUpTo(3000, out);
    expect(out.length).toBeGreaterThan(3);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]!.id).toBe(i);
      expect(out[i]!.type).toBe('collectible');
      expect(out[i]!.tags[0]).toBe('bird.coin');
      if (i > 0) expect(out[i]!.transform.position.x).toBeGreaterThan(out[i - 1]!.transform.position.x);
    }
    expect(out[0]!.transform.position.x).toBe(DEFAULT_COLLECTIBLE_CONFIG.startX);
  });

  it('placement mantém a hitbox dentro das margens', () => {
    const out: Entity[] = [];
    gen().generateUpTo(5000, out);
    for (const e of out) {
      const b = boundsOf(e.hitbox);
      expect(e.transform.position.y + b.minY).toBeGreaterThanOrEqual(DEFAULT_COLLECTIBLE_CONFIG.yMargin - 1e-9);
      expect(e.transform.position.y + b.maxY).toBeLessThanOrEqual(DEFAULT_COLLECTIBLE_CONFIG.worldHeight - DEFAULT_COLLECTIBLE_CONFIG.yMargin + 1e-9);
    }
  });

  it('catálogo cobre bird.coin com hitbox circular', () => {
    expect(COLLECTIBLE_CATALOG.some((t) => t.id === 'bird.coin')).toBe(true);
    const hb = COLLECTIBLE_CATALOG[0]!.makeHitbox(createRng('x'));
    expect(hb.kind).toBe('circle');
  });
});
