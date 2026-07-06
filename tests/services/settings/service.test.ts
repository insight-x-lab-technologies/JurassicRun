// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { settingsService } from '@services/settings';
import { memorySettingsStorage } from '@services/settings/storage';
import { i18n } from '@services/i18n';

describe('SettingsService', () => {
  beforeEach(async () => {
    await i18n.init();
  });

  it('init carrega estado persistido e aplica o idioma no i18n', async () => {
    const storage = memorySettingsStorage({
      volume: 30,
      menuMusic: false,
      gameplayMusic: true,
      language: 'pt-BR',
    });
    await settingsService.init(storage);
    expect(settingsService.volume.value).toBe(30);
    expect(settingsService.menuMusic.value).toBe(false);
    expect(settingsService.language.value).toBe('pt-BR');
    expect(i18n.getLanguage()).toBe('pt-BR');
  });

  it('setVolume/setMenuMusic comitam sinal e persistem', async () => {
    const storage = memorySettingsStorage();
    await settingsService.init(storage);
    settingsService.setVolume(15);
    settingsService.setMenuMusic(false);
    expect(settingsService.volume.value).toBe(15);
    expect(settingsService.menuMusic.value).toBe(false);
    expect(storage.load().volume).toBe(15);
    expect(storage.load().menuMusic).toBe(false);
  });

  it('setLanguage troca sinal, i18n e persiste', async () => {
    const storage = memorySettingsStorage();
    await settingsService.init(storage);
    await settingsService.setLanguage('de');
    expect(settingsService.language.value).toBe('de');
    expect(i18n.getLanguage()).toBe('de');
    expect(storage.load().language).toBe('de');
  });
});
