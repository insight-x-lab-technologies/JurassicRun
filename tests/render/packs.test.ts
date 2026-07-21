import { describe, it, expect } from 'vitest';
import { PACK_CLASSIC, packForId } from '@render/packs';
import { DEFAULT_ATLAS } from '@render/sprites';

describe('packs look&feel', () => {
  it('classic carrega o atlas real (tema default)', () => {
    expect(PACK_CLASSIC.atlas).toEqual(DEFAULT_ATLAS);
  });
  // Pré-existente à Task 5 (herdado de "liga atlas de entidades por tema", 25e7834): a asserção
  // ficou desatualizada quando volcano/glacier ganharam atlas de tema próprio; corrigida aqui
  // como achado de housekeeping (precedente W1: consertar teste vermelho encontrado no caminho).
  it('volcano/glacier definem atlas de tema próprio', () => {
    expect(packForId('volcano').atlas?.key).toBe('entities.volcano');
    expect(packForId('glacier').atlas?.key).toBe('entities.glacier');
  });
  it('packForId cai em classic para id desconhecido', () => {
    expect(packForId('nao.existe').id).toBe('classic');
  });

  describe('bgScreen por pack', () => {
    it('cada pack aponta seu fundo de tela', () => {
      expect(PACK_CLASSIC.bgScreen).toBe('bg.screen.classic');
      expect(packForId('volcano').bgScreen).toBe('bg.screen.volcano');
      expect(packForId('glacier').bgScreen).toBe('bg.screen.glacier');
    });
  });
});
