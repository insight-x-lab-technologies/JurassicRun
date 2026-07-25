import { describe, it, expect } from 'vitest';
import { spriteSizeFor, frameFor, atlasRefFor, DEFAULT_ATLAS, segmentFramesFor, layoutSegments, type SegmentLayout } from '@render/sprites';
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

describe('segmentFramesFor', () => {
  it('devolve as 3 partes para obstáculo segmentado', () => {
    expect(segmentFramesFor('obstacle.tree')).toEqual({ cap: 'obstacle.tree.cap', body: 'obstacle.tree.body', base: 'obstacle.tree.base' });
    expect(segmentFramesFor('obstacle.vine')).toEqual({ cap: 'obstacle.vine.cap', body: 'obstacle.vine.body', base: 'obstacle.vine.base' });
  });
  it('null para não-segmentado ou desconhecido', () => {
    expect(segmentFramesFor('obstacle.boulder')).toBeNull();
    expect(segmentFramesFor('obstacle.stalactite')).toBeNull();
    expect(segmentFramesFor('desconhecido')).toBeNull();
  });
});

describe('layoutSegments', () => {
  const out: SegmentLayout = { capH: 0, baseH: 0, bodyH: 0, bodyN: 0 };
  it('obstáculo alto: cap+N×body+base cobrem exatamente a altura', () => {
    const L = layoutSegments(80, 12, 8, 8, out);
    expect(L.capH).toBe(12);
    expect(L.baseH).toBe(8);
    expect(L.bodyN).toBe(8); // ceil((80-20)/8)
    expect(L.capH + L.bodyN * L.bodyH + L.baseH).toBeCloseTo(80, 6);
  });
  it('obstáculo curtíssimo: encolhe cap/base, sem body', () => {
    const L = layoutSegments(15, 12, 8, 8, out);
    expect(L.bodyN).toBe(0);
    expect(L.capH + L.baseH).toBeCloseTo(15, 6);
    expect(L.capH).toBeCloseTo(9, 6); // 12 * 15/20
  });
  it('altura zero ⇒ tudo zero', () => {
    const L = layoutSegments(0, 12, 8, 8, out);
    expect(L).toEqual({ capH: 0, baseH: 0, bodyH: 0, bodyN: 0 });
  });
  it('muta e devolve o MESMO objeto out (alocação-zero)', () => {
    expect(layoutSegments(80, 12, 8, 8, out)).toBe(out);
  });
});
