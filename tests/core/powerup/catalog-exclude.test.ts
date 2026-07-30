import { describe, it, expect } from 'vitest';
import { POWERUP_CATALOG, POWERUP_KINDS, powerupCatalogExcluding } from '@core/powerup';

describe('powerupCatalogExcluding', () => {
  it('remove exatamente o tipo banido', () => {
    for (const kind of POWERUP_KINDS) {
      const filtered = powerupCatalogExcluding(kind);
      expect(filtered).toHaveLength(POWERUP_CATALOG.length - 1);
      expect(filtered.some((t) => t.id === `powerup.${kind}`)).toBe(false);
    }
  });

  it('memoiza: mesma referência congelada em chamadas repetidas', () => {
    const a = powerupCatalogExcluding('shield');
    const b = powerupCatalogExcluding('shield');
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('preserva as refs das entradas restantes (mesma ordem do catálogo)', () => {
    const filtered = powerupCatalogExcluding('magnet');
    const expected = POWERUP_CATALOG.filter((t) => t.id !== 'powerup.magnet');
    expect(filtered.every((t, i) => t === expected[i])).toBe(true);
  });
});
