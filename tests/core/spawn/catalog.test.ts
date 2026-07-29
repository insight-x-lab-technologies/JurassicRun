import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { OBSTACLE_CATALOG, SPAWN_Y_MARGIN } from '@core/spawn';
import { WORLD_HEIGHT } from '@core/sim/constants';
import { boundsOf } from '@core/sim/hitbox';
import type { SpawnField, SpawnPiece } from '@core/spawn';

describe('OBSTACLE_CATALOG', () => {
  it('tem ids únicos e âncoras válidas', () => {
    const ids = OBSTACLE_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of OBSTACLE_CATALOG) {
      expect(t.id.startsWith('obstacle.')).toBe(true);
      if (t.makePieces === undefined) expect(['floor', 'ceiling', 'floating']).toContain(t.anchor);
    }
  });

  it('cobre os três tipos de hitbox (não só retângulos)', () => {
    const rng = createRng('catalog-test');
    const kinds = new Set(
      OBSTACLE_CATALOG.filter((t) => t.makePieces === undefined).map((t) => t.makeHitbox!(rng).kind),
    );
    expect(kinds.has('aabb')).toBe(true);
    expect(kinds.has('circle')).toBe(true);
    expect(kinds.has('polygon')).toBe(true);
  });

  it('makeHitbox é determinístico para o mesmo estado de rng', () => {
    const t = OBSTACLE_CATALOG[0]!;
    if (t.makePieces !== undefined) throw new Error('esperado tipo simples na posição 0');
    const a = t.makeHitbox(createRng('seed-x'));
    const b = t.makeHitbox(createRng('seed-x'));
    expect(a).toEqual(b);
  });
});

const FIELD: SpawnField = { worldHeight: WORLD_HEIGHT, yMargin: SPAWN_Y_MARGIN };
const DINO_H = 16;
const MIN_PASSAGE = 30; // ≈1,9× a altura do dino

function typeById(id: string) {
  const t = OBSTACLE_CATALOG.find((x) => x.id === id);
  expect(t, `tipo ausente no catálogo: ${id}`).toBeDefined();
  return t!;
}

/** Faixa vertical [topo, base] ocupada por uma peça. */
function span(p: SpawnPiece): { top: number; bottom: number } {
  const b = boundsOf(p.hitbox);
  return { top: p.y + b.minY, bottom: p.y + b.maxY };
}

describe('justiça dos obstáculos novos (9.8)', () => {
  it('gate: fresta sempre passável e braços não degeneram', () => {
    const t = typeById('obstacle.gate');
    const rng = createRng('fairness-gate');
    for (let i = 0; i < 500; i++) {
      const pieces = t.makePieces!(rng, FIELD);
      expect(pieces).toHaveLength(2);
      const [ceilPiece, floorPiece] = pieces;
      const ceil = span(ceilPiece!);
      const floor = span(floorPiece!);
      expect(ceil.top).toBeCloseTo(FIELD.yMargin, 6);
      expect(floor.bottom).toBeCloseTo(FIELD.worldHeight - FIELD.yMargin, 6);
      expect(floor.top - ceil.bottom).toBeGreaterThanOrEqual(MIN_PASSAGE);
      expect(ceil.bottom - ceil.top).toBeGreaterThanOrEqual(12);
      expect(floor.bottom - floor.top).toBeGreaterThanOrEqual(12);
    }
  });

  it('rock_arch: buraco entre as pernas e vão superior sempre passáveis', () => {
    const t = typeById('obstacle.rock_arch');
    const rng = createRng('fairness-arch');
    for (let i = 0; i < 500; i++) {
      const pieces = t.makePieces!(rng, FIELD);
      expect(pieces).toHaveLength(3);
      const legs = pieces.filter((p) => p.tag === 'obstacle.rock_arch.leg');
      const spanPiece = pieces.find((p) => p.tag === 'obstacle.rock_arch.span')!;
      expect(legs).toHaveLength(2);
      const legSpan = span(legs[0]!);
      const barSpan = span(spanPiece);
      // pernas apoiadas no chão
      expect(legSpan.bottom).toBeCloseTo(FIELD.worldHeight - FIELD.yMargin, 6);
      // buraco = do chão até a trave
      expect(legSpan.bottom - legSpan.top).toBeGreaterThanOrEqual(MIN_PASSAGE);
      // trave encostada no topo das pernas (sem invadir o buraco)
      expect(barSpan.bottom).toBeCloseTo(legSpan.top, 6);
      // vão por cima da trave
      expect(barSpan.top - FIELD.yMargin).toBeGreaterThanOrEqual(MIN_PASSAGE);
      // as pernas ficam de lados opostos e a trave as cobre
      expect(legs[0]!.dx).toBeLessThan(0);
      expect(legs[1]!.dx).toBeGreaterThan(0);
      expect(boundsOf(spanPiece.hitbox).maxX).toBeGreaterThanOrEqual(
        legs[1]!.dx + boundsOf(legs[1]!.hitbox).maxX - 1e-9,
      );
    }
  });

  it('spire: estreita, alta e sempre com um lado largo para passar', () => {
    const t = typeById('obstacle.spire');
    const rng = createRng('fairness-spire');
    for (let i = 0; i < 500; i++) {
      const h = t.makeHitbox!(rng);
      expect(h.kind).toBe('aabb');
      if (h.kind !== 'aabb') continue;
      expect(h.halfW * 2).toBeLessThanOrEqual(12);
      const free = FIELD.worldHeight - 2 * FIELD.yMargin - h.halfH * 2;
      expect(free / 2).toBeGreaterThanOrEqual(MIN_PASSAGE); // pior caso (centrado)
      expect(h.halfH * 2).toBeGreaterThan(DINO_H);
    }
  });

  it('todo tipo composto emite peças com hitbox dentro do campo', () => {
    const rng = createRng('fairness-bounds');
    for (const t of OBSTACLE_CATALOG) {
      if (t.makePieces === undefined) continue;
      for (let i = 0; i < 200; i++) {
        for (const p of t.makePieces(rng, FIELD)) {
          const s = span(p);
          expect(s.top).toBeGreaterThanOrEqual(FIELD.yMargin - 1e-9);
          expect(s.bottom).toBeLessThanOrEqual(FIELD.worldHeight - FIELD.yMargin + 1e-9);
        }
      }
    }
  });
});

// Campo degenerado: worldHeight tão pequeno que o par do gate não cabe (tMax < tMin) — exercita
// o clamp de I1 (ceilH/floorH nunca negativos) e ainda assim precisa consumir o mesmo nº de
// saques de RNG do caso normal (contrato de determinismo/estabilidade do stream).
const DEGENERATE_FIELD: SpawnField = { worldHeight: 60, yMargin: 8 };

// Nº de saques de RNG (`next()`) que cada tipo composto consome por chamada de `makePieces`,
// FIXO independente do campo (inclusive no ramo degenerado). Se um tipo composto mudar de
// tuning e passar a consumir um nº variável de saques, o stream do SpawnGenerator deixa de ser
// estável entre fps/replays — este teste pina o nº esperado para pegar a regressão cedo.
const COMPOSITE_RNG_DRAWS: Record<string, number> = {
  'obstacle.gate': 2, // rng.range(gap) + rng.next(u)
  'obstacle.rock_arch': 1, // rng.range(legH)
};

describe('consumo de RNG dos tipos compostos é fixo (determinismo)', () => {
  for (const [id, draws] of Object.entries(COMPOSITE_RNG_DRAWS)) {
    for (const field of [FIELD, DEGENERATE_FIELD]) {
      it(`${id}: consome exatamente ${draws} saque(s) em worldHeight=${field.worldHeight}`, () => {
        const t = typeById(id);
        const seed = `rng-draws-${id}-${field.worldHeight}`;

        const rngViaPieces = createRng(seed);
        const pieces = t.makePieces!(rngViaPieces, field);

        const rngViaNext = createRng(seed);
        for (let i = 0; i < draws; i++) rngViaNext.next();

        // Mesmo nº de saques consumidos ⇒ o próximo valor sorteado por ambos os streams coincide.
        expect(rngViaPieces.next()).toBe(rngViaNext.next());

        // Ramo degenerado (I1): nenhuma peça pode sair com hitbox invertida (halfH negativo).
        for (const p of pieces) {
          if (p.hitbox.kind === 'aabb') expect(p.hitbox.halfH).toBeGreaterThanOrEqual(0);
        }
      });
    }
  }
});
