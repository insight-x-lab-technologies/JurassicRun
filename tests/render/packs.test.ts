import { describe, it, expect } from 'vitest';
import { PACK_CLASSIC, packForId } from '@render/packs';
import { DEFAULT_ATLAS } from '@render/sprites';

describe('packs look&feel', () => {
  it('classic carrega o atlas real (tema default)', () => {
    expect(PACK_CLASSIC.atlas).toEqual(DEFAULT_ATLAS);
  });
  it('volcano/glacier não definem atlas próprio (reusam o default)', () => {
    expect(packForId('volcano').atlas).toBeUndefined();
    expect(packForId('glacier').atlas).toBeUndefined();
  });
  it('packForId cai em classic para id desconhecido', () => {
    expect(packForId('nao.existe').id).toBe('classic');
  });
});
