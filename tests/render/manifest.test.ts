import { describe, it, expect } from 'vitest';
import { ASSET_MANIFEST, DINO_TYPE_ID, renderableFor } from '@render/manifest';
import { OBSTACLE_CATALOG, COLLECTIBLE_CATALOG } from '@core/spawn';
import { POWERUP_CATALOG } from '@core/powerup';

describe('manifesto de assets', () => {
  it('mapeia um id conhecido para um Renderable', () => {
    const r = renderableFor(DINO_TYPE_ID);
    expect(r.kind).toBe('primitive');
    if (r.kind === 'primitive') {
      expect(r.color).toBe(0xcc5544);
      expect(r.shape).toBe('triangle');
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
