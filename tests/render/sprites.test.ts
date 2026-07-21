import { describe, it, expect } from 'vitest';
import { spriteSizeFor, frameFor, atlasRefFor, DEFAULT_ATLAS } from '@render/sprites';
import { aabb, circle, polygon } from '@core/sim/hitbox';
import { DINO_TYPE_ID } from '@render/manifest';
import { PACK_CLASSIC, packForId } from '@render/packs';

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

describe('seam de atlas por tema', () => {
  it('DEFAULT_ATLAS aponta para o atlas de entidades', () => {
    expect(DEFAULT_ATLAS).toEqual({ key: 'entities', png: 'atlas/entities.png', json: 'atlas/entities.json' });
  });
  it('atlasRefFor: classic usa seu próprio atlas', () => {
    expect(atlasRefFor(PACK_CLASSIC)).toEqual(DEFAULT_ATLAS);
  });
  // Pré-existente à Task 5 (herdado de "liga atlas de entidades por tema", 25e7834): a asserção
  // ficou desatualizada quando volcano/glacier ganharam atlas de tema próprio; corrigida aqui
  // como achado de housekeeping (precedente W1: consertar teste vermelho encontrado no caminho).
  it('atlasRefFor: volcano/glacier usam seus próprios atlas de tema', () => {
    expect(atlasRefFor(packForId('volcano'))).toEqual({
      key: 'entities.volcano', png: 'atlas/entities.volcano.png', json: 'atlas/entities.volcano.json',
    });
    expect(atlasRefFor(packForId('glacier'))).toEqual({
      key: 'entities.glacier', png: 'atlas/entities.glacier.png', json: 'atlas/entities.glacier.json',
    });
  });
});
