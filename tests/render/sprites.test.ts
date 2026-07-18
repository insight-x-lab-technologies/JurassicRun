import { describe, it, expect } from 'vitest';
import { spriteSizeFor, frameFor } from '@render/sprites';
import { aabb, circle, polygon } from '@core/sim/hitbox';
import { DINO_TYPE_ID } from '@render/manifest';

describe('helpers de sprite', () => {
  it('spriteSizeFor: aabb = 2·half', () => {
    expect(spriteSizeFor(aabb(6, 20))).toEqual({ w: 12, h: 40 });
  });
  it('spriteSizeFor: circle = 2·r', () => {
    expect(spriteSizeFor(circle(9))).toEqual({ w: 18, h: 18 });
  });
  it('spriteSizeFor: polygon = extensão min/max', () => {
    const h = polygon([{ x: -8, y: -11 }, { x: 8, y: -11 }, { x: 0, y: 11 }]);
    expect(spriteSizeFor(h)).toEqual({ w: 16, h: 22 });
  });
  it('frameFor: id sprite conhecido devolve o frame', () => {
    expect(frameFor(DINO_TYPE_ID)).toBe(DINO_TYPE_ID);
  });
  it('frameFor: id desconhecido (fallback primitivo) devolve null', () => {
    expect(frameFor('nao.existe')).toBeNull();
  });
});
