import { describe, it, expect } from 'vitest';
import {
  EXPANSION_CATALOG,
  DEFAULT_EXPANSION_ID,
  expansionById,
} from '@services/entitlements/catalog';

describe('expansion catalog', () => {
  it('tem ids únicos', () => {
    const ids = EXPANSION_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('inclui a expansão default como free', () => {
    const def = expansionById(DEFAULT_EXPANSION_ID);
    expect(def).toBeDefined();
    expect(def!.tier).toBe('free');
  });

  it('as demais expansões são premium', () => {
    for (const e of EXPANSION_CATALOG) {
      if (e.id !== DEFAULT_EXPANSION_ID) expect(e.tier).toBe('premium');
    }
  });

  it('expansionById devolve undefined para id desconhecido', () => {
    expect(expansionById('nope')).toBeUndefined();
  });

  it('cada expansão tem chaves i18n de nome e descrição', () => {
    for (const e of EXPANSION_CATALOG) {
      expect(e.nameKey).toBe(`expansion.${e.id}.name`);
      expect(e.descKey).toBe(`expansion.${e.id}.desc`);
    }
  });
});
