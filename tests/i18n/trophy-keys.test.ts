import { describe, it, expect } from 'vitest';
import { TROPHY_CATALOG } from '@services/trophy/catalog';
import en from '@i18n/locales/en.json';

type Bag = Record<string, unknown>;
const get = (bag: Bag, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Bag | undefined)?.[k], bag);

describe('chaves i18n dos troféus', () => {
  it('todo troféu do catálogo tem nome e descrição não-vazios em en', () => {
    for (const t of TROPHY_CATALOG) {
      expect(typeof get(en as Bag, t.nameKey), t.nameKey).toBe('string');
      expect(String(get(en as Bag, t.nameKey)).length, t.nameKey).toBeGreaterThan(0);
      expect(typeof get(en as Bag, t.descKey), t.descKey).toBe('string');
      expect(String(get(en as Bag, t.descKey)).length, t.descKey).toBeGreaterThan(0);
    }
  });

  it('trophies.progress existe e interpola desbloqueados/total', () => {
    const s = String(get(en as Bag, 'trophies.progress'));
    expect(s).toContain('{{unlocked}}');
    expect(s).toContain('{{total}}');
  });
});
