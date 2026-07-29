import { describe, it, expect } from 'vitest';
import { ASSET_MANIFEST, DINO_TYPE_ID, renderableFor } from '@render/manifest';
import { OBSTACLE_CATALOG, COLLECTIBLE_CATALOG } from '@core/spawn';
import { createRng } from '@core/rng';
import type { SpawnField } from '@core/spawn';
import { POWERUP_CATALOG } from '@core/powerup';

const FIELD: SpawnField = { worldHeight: 180, yMargin: 8 };

/** Tags que o gerador de fato coloca em `entity.tags[0]` — para tipo composto, as tags das peças. */
function emittedTags(catalog: readonly { id: string; makePieces?: unknown }[]): string[] {
  const out: string[] = [];
  for (const t of catalog) {
    const composite = t as { id: string; makePieces?: (rng: ReturnType<typeof createRng>, f: SpawnField) => readonly { tag?: string }[] };
    if (composite.makePieces === undefined) { out.push(t.id); continue; }
    const rng = createRng('manifest-guard');
    for (const p of composite.makePieces(rng, FIELD)) out.push(p.tag ?? t.id);
  }
  return out;
}

describe('manifesto de assets', () => {
  it('mapeia o dino para um sprite do atlas', () => {
    const r = renderableFor(DINO_TYPE_ID);
    expect(r.kind).toBe('sprite');
    if (r.kind === 'sprite') {
      expect(r.atlas).toBe('entities');
      expect(r.frame).toBe(DINO_TYPE_ID);
    }
  });

  it('cai num fallback primitivo para id desconhecido (não quebra)', () => {
    const r = renderableFor('nao.existe');
    expect(r.kind).toBe('primitive');
  });

  it('COMPLETUDE: toda tag emitida pelos catálogos + o dino têm entrada no manifesto', () => {
    const ids = [
      DINO_TYPE_ID,
      ...emittedTags(OBSTACLE_CATALOG),
      ...emittedTags(COLLECTIBLE_CATALOG),
      ...emittedTags(POWERUP_CATALOG),
    ];
    for (const id of ids) {
      expect(ASSET_MANIFEST[id], `id sem entrada no manifesto: ${id}`).toBeDefined();
    }
  });

  it('IDLE (9.4): só obstáculo anima — dino/coletáveis/power-ups ficam sem `idle`', () => {
    for (const [id, r] of Object.entries(ASSET_MANIFEST)) {
      if (r.kind !== 'sprite' || r.idle === undefined) continue;
      expect(id.startsWith('obstacle.'), `id não-obstáculo com idle: ${id}`).toBe(true);
    }
  });
});
