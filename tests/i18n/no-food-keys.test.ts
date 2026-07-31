import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, resources } from '@i18n/locales/index';

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? keyPaths(v as Record<string, unknown>, path)
      : [path];
  });
}

// 10.4: a UI fala "moedas". Guarda sobre as CHAVES (verificável nos 10 idiomas), não sobre os
// textos traduzidos — caçar a palavra "comida" em 10 línguas exigiria um dicionário que o projeto
// não tem como manter. Ids de código como `trait.doubleFood` seguem permitidos: são ids, não a
// palavra na tela.
describe('vocabulário de moeda', () => {
  it('nenhum locale tem uma chave chamada `food`', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      // `resources[lang]` é `{ translation: {...} }` — o dicionário fica sob `.translation`.
      const offenders = keyPaths(resources[lang].translation).filter((p) =>
        p.split('.').includes('food'),
      );
      expect(offenders, `locale ${lang}`).toEqual([]);
    }
  });
});
