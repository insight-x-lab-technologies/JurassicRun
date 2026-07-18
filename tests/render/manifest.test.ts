import { describe, it, expect } from 'vitest';
import { ASSET_MANIFEST, DINO_TYPE_ID, renderableFor } from '@render/manifest';
import { OBSTACLE_CATALOG, COLLECTIBLE_CATALOG } from '@core/spawn';
import { POWERUP_CATALOG } from '@core/powerup';

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

  it('COMPLETUDE: todo tipo do catálogo + o dino têm entrada no manifesto', () => {
    const ids = [
      DINO_TYPE_ID,
      ...OBSTACLE_CATALOG.map((t) => t.id),
      ...COLLECTIBLE_CATALOG.map((t) => t.id),
      ...POWERUP_CATALOG.map((t) => t.id),
    ];
    for (const id of ids) {
      expect(ASSET_MANIFEST[id], `id sem entrada no manifesto: ${id}`).toBeDefined();
    }
  });
});
