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
});
