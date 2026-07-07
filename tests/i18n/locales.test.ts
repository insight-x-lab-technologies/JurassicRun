import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, resources } from '@i18n/locales/index';

// Coleta todos os key-paths "profundos" de um objeto aninhado.
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? keyPaths(v as Record<string, unknown>, path)
      : [path];
  });
}

// Achata para { "a.b.c": "valor" } — só folhas string.
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') {
      Object.assign(out, flatten(v as Record<string, unknown>, path));
    } else {
      out[path] = v as string;
    }
  }
  return out;
}

// Conjunto ordenado de nomes de placeholder {{nome}} num valor.
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map((m) => m[1] ?? '').sort();
}

describe('locales', () => {
  it('expõe exatamente os 10 idiomas, com en primeiro', () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      'en', 'es', 'pt-BR', 'fr', 'it', 'de', 'ja', 'zh', 'ko', 'hi',
    ]);
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('tem um recurso de tradução para cada idioma suportado', () => {
    for (const lng of SUPPORTED_LANGUAGES) {
      expect(resources[lng]?.translation).toBeTypeOf('object');
    }
  });

  it('todos os locales têm paridade de chaves com en', () => {
    const enKeys = keyPaths(resources.en.translation).sort();
    for (const lng of SUPPORTED_LANGUAGES) {
      const keys = keyPaths(resources[lng].translation).sort();
      expect(keys, `chaves de ${lng} divergem de en`).toEqual(enKeys);
    }
  });

  it('cada locale preserva os mesmos placeholders de interpolação que en', () => {
    const en = flatten(resources.en.translation);
    for (const lng of SUPPORTED_LANGUAGES) {
      const t = flatten(resources[lng].translation);
      for (const key of Object.keys(en)) {
        expect(
          placeholders(t[key] ?? ''),
          `${lng} > ${key}: placeholders divergem de en`,
        ).toEqual(placeholders(en[key] ?? ''));
      }
    }
  });

  it('nenhum valor de tradução é vazio ou só-espaço', () => {
    for (const lng of SUPPORTED_LANGUAGES) {
      const t = flatten(resources[lng].translation);
      for (const [key, val] of Object.entries(t)) {
        expect(typeof val, `${lng} > ${key}: valor não é string`).toBe('string');
        expect(val.trim().length, `${lng} > ${key}: valor vazio`).toBeGreaterThan(0);
      }
    }
  });
});
