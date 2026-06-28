import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { boundsOf } from '@core/sim';
import type { Entity } from '@core/sim';
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG } from '@core/spawn';
import type { SpawnConfig } from '@core/spawn';

const CONFIG: SpawnConfig = { ...DEFAULT_SPAWN_CONFIG, worldHeight: 180 };

function gen(seed = 'gen-test'): SpawnGenerator {
  return new SpawnGenerator(createRng(seed).fork('obstacles'), CONFIG);
}

describe('SpawnGenerator.generateUpTo', () => {
  it('não emite nada abaixo de startX', () => {
    const out: Entity[] = [];
    gen().generateUpTo(CONFIG.startX - 1, out);
    expect(out).toEqual([]);
  });

  it('emite obstáculos com x crescente e ids monotônicos a partir de 0', () => {
    const out: Entity[] = [];
    gen().generateUpTo(2000, out);
    expect(out.length).toBeGreaterThan(3);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]!.id).toBe(i);
      expect(out[i]!.type).toBe('obstacle');
      expect(out[i]!.tags[0]!.startsWith('obstacle.')).toBe(true);
      if (i > 0) expect(out[i]!.transform.position.x).toBeGreaterThan(out[i - 1]!.transform.position.x);
    }
    expect(out[0]!.transform.position.x).toBe(CONFIG.startX);
  });

  it('placement mantém a hitbox dentro de [margin, worldHeight - margin]', () => {
    const out: Entity[] = [];
    gen().generateUpTo(5000, out);
    for (const e of out) {
      const b = boundsOf(e.hitbox);
      const top = e.transform.position.y + b.minY;
      const bottom = e.transform.position.y + b.maxY;
      expect(top).toBeGreaterThanOrEqual(CONFIG.yMargin - 1e-9);
      expect(bottom).toBeLessThanOrEqual(CONFIG.worldHeight - CONFIG.yMargin + 1e-9);
    }
  });

  it('clone isola estado: avançar o clone não afeta o original', () => {
    const g = gen();
    const a: Entity[] = [];
    g.generateUpTo(600, a);
    const c = g.clone();
    const more: Entity[] = [];
    c.generateUpTo(5000, more);
    const aTail: Entity[] = [];
    g.generateUpTo(5000, aTail); // g continua de onde parou, igual ao clone
    expect(aTail).toEqual(more);
  });
});
