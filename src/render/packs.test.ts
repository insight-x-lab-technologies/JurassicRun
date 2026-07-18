import { describe, it, expect } from 'vitest';
import { PACK_CLASSIC, LOOK_PACKS, packForId } from './packs';
import { DAY_NIGHT_PALETTES } from './daynight';
import { PARALLAX_LAYERS } from './parallax';
import { EXPANSION_CATALOG } from '@services/entitlements';

describe('packs', () => {
  it('classic reproduz o look atual (zero regressão)', () => {
    expect(PACK_CLASSIC.id).toBe('classic');
    expect(PACK_CLASSIC.dayNight).toEqual(DAY_NIGHT_PALETTES);
    expect(PACK_CLASSIC.entityTint).toBe(0xffffff);
    // cores de parallax na mesma ordem das camadas
    PARALLAX_LAYERS.forEach((layer, i) => {
      if (layer.visual.kind === 'primitive') {
        expect(PACK_CLASSIC.parallax[i]!.color).toBe(layer.visual.color);
      }
    });
  });

  it('packForId faz fallback para classic em id desconhecido', () => {
    expect(packForId('nope')).toBe(PACK_CLASSIC);
    expect(packForId('classic')).toBe(PACK_CLASSIC);
  });

  it('todo id de expansão tem um pack (guarda de completude)', () => {
    for (const exp of EXPANSION_CATALOG) {
      expect(LOOK_PACKS.find((p) => p.id === exp.id)).toBeDefined();
    }
  });

  it('packs alternativos diferem do classic', () => {
    for (const id of ['volcano', 'glacier']) {
      const p = packForId(id);
      expect(p.id).toBe(id);
      expect(p).not.toBe(PACK_CLASSIC);
      expect(p.dayNight).not.toEqual(DAY_NIGHT_PALETTES);
    }
  });
});
