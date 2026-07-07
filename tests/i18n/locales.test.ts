import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  resources,
  type SupportedLanguage,
} from '@i18n/locales/index';

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

const LOCALES_NON_EN = SUPPORTED_LANGUAGES.filter((l) => l !== DEFAULT_LANGUAGE);

// Um valor de locale byte-idêntico ao en só é legítimo quando é marca, nome
// próprio, acrônimo/abreviação universal, empréstimo de gaming ou cognato real
// na língua. Cada par locale::chave abaixo veio da auditoria do item 4.9.
// Só adicionar aqui COM justificativa; senão, traduza a string.
const IDENTICAL_TO_EN_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  // Marca "JurassicRun" — não se traduz.
  ...LOCALES_NON_EN.flatMap((l) => [`${l}::app.title`, `${l}::share.title`]),
  // Acrônimo universal "FPS".
  ...LOCALES_NON_EN.map((l) => `${l}::hud.fps`),
  // Nome próprio "Midas" (it/zh/ja/ko o localizam; estes o mantêm).
  'es::dino.midas.name', 'pt-BR::dino.midas.name', 'fr::dino.midas.name', 'de::dino.midas.name',
  // Abreviação "Dist" de Distância/Distance/Distanza/Distanz.
  'es::hud.distance', 'pt-BR::hud.distance', 'fr::hud.distance', 'it::hud.distance', 'de::hud.distance',
  // "Lv" — abreviação universal de nível em jogos (ja/ko).
  'ja::hud.level', 'ko::hud.level',
  // "Seed" — empréstimo padrão em alemão de gaming.
  'de::hud.seed',
  // "Game Over" — mantido em italiano.
  'it::gameover.title',
  // Cognatos alemães reais: "Nest"/"Wind"; empréstimo padrão "Shop".
  'de::nav.nest', 'de::screen.nest', 'de::nest.title', 'de::weather.wind',
  'de::nav.shop', 'de::screen.shop', 'de::shop.title',
  // Cognatos franceses reais: "Active"/"Glacier"/"Centurion".
  'fr::expansions.active', 'fr::expansion.glacier.name', 'fr::trophy.centurion.name',
  // "Volume" — idêntico em pt-BR/fr/it.
  'pt-BR::settings.volume', 'fr::settings.volume', 'it::settings.volume',
]);

// Valor que é só interpolação (ex.: "{{value}}") não tem o que traduzir.
const isPureInterpolation = (s: string): boolean => /^\s*\{\{[^}]+\}\}\s*$/.test(s);

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

  it('todo valor idêntico ao en é traduzido ou está na allowlist justificada', () => {
    const en = flatten(resources.en.translation);
    const offenders: string[] = [];
    for (const lng of LOCALES_NON_EN) {
      const t = flatten(resources[lng].translation);
      for (const key of Object.keys(en)) {
        if (t[key] === en[key] && !isPureInterpolation(en[key] ?? '')) {
          const pair = `${lng}::${key}`;
          if (!IDENTICAL_TO_EN_ALLOWLIST.has(pair)) offenders.push(pair);
        }
      }
    }
    expect(
      offenders,
      `strings não traduzidas (idênticas ao en) — traduza, ou justifique na allowlist: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('a allowlist de idênticos não tem entradas obsoletas', () => {
    const en = flatten(resources.en.translation);
    const stale: string[] = [];
    for (const pair of IDENTICAL_TO_EN_ALLOWLIST) {
      const [lng, key] = pair.split('::') as [SupportedLanguage, string];
      const t = flatten(resources[lng].translation);
      if (t[key] !== en[key]) stale.push(pair);
    }
    expect(
      stale,
      `entradas obsoletas na allowlist (não são mais idênticas ao en): ${stale.join(', ')}`,
    ).toEqual([]);
  });
});
