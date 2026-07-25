import { describe, it, expect } from 'vitest';
import { segmentFramesFor, layoutSegments, type SegmentLayout } from '@render/sprites';

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
