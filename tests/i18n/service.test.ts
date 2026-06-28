import { describe, it, expect, beforeEach } from 'vitest';
import { i18n } from '@services/i18n';

describe('I18nService', () => {
  beforeEach(async () => {
    await i18n.init();
    await i18n.changeLanguage('en');
  });

  it('inicia em en e resolve uma chave', () => {
    expect(i18n.getLanguage()).toBe('en');
    expect(i18n.t('app.title')).toBe('JurassicRun');
    expect(i18n.t('app.loading')).toBe('Loading…');
  });

  it('troca de idioma e resolve a chave traduzida', async () => {
    await i18n.changeLanguage('pt-BR');
    expect(i18n.getLanguage()).toBe('pt-BR');
    expect(i18n.t('app.loading')).toBe('Carregando…');
  });

  it('ignora idioma não suportado', async () => {
    await i18n.changeLanguage('xx');
    expect(i18n.getLanguage()).toBe('en');
  });

  it('chave ausente retorna a própria key (fallbackLng configurado)', () => {
    // Paridade garante que nenhuma chave existe só em um locale, então o cenário
    // observável de "ausência" é a chave inexistente em todos: i18next devolve a key.
    expect(i18n.t('app.missing')).toBe('app.missing');
  });

  it('init é idempotente', async () => {
    await i18n.init();
    expect(i18n.t('app.title')).toBe('JurassicRun');
  });
});
