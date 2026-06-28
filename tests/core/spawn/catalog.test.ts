import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { OBSTACLE_CATALOG } from '@core/spawn';

describe('OBSTACLE_CATALOG', () => {
  it('tem ids únicos e âncoras válidas', () => {
    const ids = OBSTACLE_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of OBSTACLE_CATALOG) {
      expect(t.id.startsWith('obstacle.')).toBe(true);
      expect(['floor', 'ceiling', 'floating']).toContain(t.anchor);
    }
  });

  it('cobre os três tipos de hitbox (não só retângulos)', () => {
    const rng = createRng('catalog-test');
    const kinds = new Set(OBSTACLE_CATALOG.map((t) => t.makeHitbox(rng).kind));
    expect(kinds.has('aabb')).toBe(true);
    expect(kinds.has('circle')).toBe(true);
    expect(kinds.has('polygon')).toBe(true);
  });

  it('makeHitbox é determinístico para o mesmo estado de rng', () => {
    const t = OBSTACLE_CATALOG[0]!;
    const a = t.makeHitbox(createRng('seed-x'));
    const b = t.makeHitbox(createRng('seed-x'));
    expect(a).toEqual(b);
  });
});
