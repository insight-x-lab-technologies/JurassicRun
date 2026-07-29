import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { boundsOf } from '@core/sim';
import { aabb } from '@core/sim/hitbox';
import type { Entity } from '@core/sim';
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG } from '@core/spawn';
import type { SpawnConfig, SpawnType } from '@core/spawn';
import { difficultyAt } from '@core/difficulty';

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

describe('SpawnGenerator — gapScale (dificuldade)', () => {
  function meanGaps(out: { transform: { position: { x: number } } }[]): number[] {
    const gaps: number[] = [];
    for (let i = 1; i < out.length; i++) {
      gaps.push(out[i]!.transform.position.x - out[i - 1]!.transform.position.x);
    }
    return gaps;
  }

  it('gapScale default (() => 1) ⇒ idêntico ao comportamento atual', () => {
    const a: Entity[] = [];
    new SpawnGenerator(createRng('s').fork('obstacles'), CONFIG).generateUpTo(5000, a);
    const b: Entity[] = [];
    new SpawnGenerator(createRng('s').fork('obstacles'), CONFIG, undefined, undefined, () => 1).generateUpTo(5000, b);
    expect(b).toEqual(a);
  });

  it('com gapScale da dificuldade, o campo fica mais denso longe da origem', () => {
    const out: Entity[] = [];
    new SpawnGenerator(
      createRng('dense').fork('obstacles'),
      CONFIG,
      undefined,
      undefined,
      (x) => difficultyAt(x).gapScale,
    ).generateUpTo(60000, out);
    const gaps = meanGaps(out);
    const early = gaps.slice(0, 10).reduce((s, g) => s + g, 0) / 10;
    const late = gaps.slice(-10).reduce((s, g) => s + g, 0) / 10;
    expect(late).toBeLessThan(early); // gaps encolheram ⇒ densidade subiu
  });

  it('clone propaga o gapScale (gera idêntico ao original a partir do mesmo ponto)', () => {
    const g = new SpawnGenerator(
      createRng('clone').fork('obstacles'),
      CONFIG,
      undefined,
      undefined,
      (x) => difficultyAt(x).gapScale,
    );
    const a: Entity[] = [];
    g.generateUpTo(3000, a);
    const c = g.clone();
    const fromClone: Entity[] = [];
    c.generateUpTo(30000, fromClone);
    const fromOrig: Entity[] = [];
    g.generateUpTo(30000, fromOrig);
    expect(fromOrig).toEqual(fromClone);
  });
});

/** Tipo composto de teste: 2 peças a ±10 em x, y fixos. Consome 1 saque. */
const COMPOSITE: SpawnType = {
  id: 'obstacle.test_composite',
  makePieces: (rng, field) => {
    const h = 10 + rng.next() * 10;
    return [
      { hitbox: aabb(3, h / 2), dx: -10, y: field.yMargin + h / 2 },
      { hitbox: aabb(3, h / 2), dx: 10, y: field.worldHeight - field.yMargin - h / 2, tag: 'obstacle.test_composite.low' },
    ];
  },
};

describe('obstáculo composto', () => {
  it('emite uma entidade por peça, no mesmo evento de spawn', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const out: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX, out);
    expect(out).toHaveLength(2);
    expect(out[0]!.transform.position.x).toBe(DEFAULT_SPAWN_CONFIG.startX - 10);
    expect(out[1]!.transform.position.x).toBe(DEFAULT_SPAWN_CONFIG.startX + 10);
  });

  it('ids são sequenciais entre peças e entre eventos', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const out: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 500, out);
    expect(out.map((e) => e.id)).toEqual(out.map((_, i) => i));
  });

  it('a tag da peça manda; sem tag, herda o id do tipo', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const out: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX, out);
    expect(out[0]!.tags).toEqual(['obstacle.test_composite']);
    expect(out[1]!.tags).toEqual(['obstacle.test_composite.low']);
  });

  it('mesma seed ⇒ mesmas peças (determinismo)', () => {
    const run = () => {
      const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
      const out: Entity[] = [];
      g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 900, out);
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('clone() preserva o cursor e o estado do rng com compostos', () => {
    const g = new SpawnGenerator(createRng('comp').fork('obstacles'), DEFAULT_SPAWN_CONFIG, [COMPOSITE]);
    const warm: Entity[] = [];
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 300, warm);
    const a: Entity[] = [];
    const b: Entity[] = [];
    g.clone().generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 900, a);
    g.generateUpTo(DEFAULT_SPAWN_CONFIG.startX + 900, b);
    expect(a).toEqual(b);
  });
});
