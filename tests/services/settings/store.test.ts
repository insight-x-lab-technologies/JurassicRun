import { describe, it, expect } from 'vitest';
import {
  initialSettingsState,
  sanitizeVolume,
  setVolume,
  setMenuMusic,
  setGameplayMusic,
  setLanguage,
  isSupportedLanguage,
} from '@services/settings/store';

describe('settings/store', () => {
  it('estado inicial: volume 80, músicas on, idioma en, fonte Cinzel', () => {
    expect(initialSettingsState()).toEqual({
      volume: 80,
      menuMusic: true,
      gameplayMusic: true,
      language: 'en',
      font: 'cinzel',
    });
  });

  it('sanitizeVolume clampa e arredonda; inválido ⇒ 0', () => {
    expect(sanitizeVolume(50.4)).toBe(50);
    expect(sanitizeVolume(50.6)).toBe(51);
    expect(sanitizeVolume(-5)).toBe(0);
    expect(sanitizeVolume(140)).toBe(100);
    expect(sanitizeVolume(Number.NaN)).toBe(0);
    expect(sanitizeVolume(Number.POSITIVE_INFINITY)).toBe(100);
  });

  it('setVolume aplica sanitização e é imutável', () => {
    const s = initialSettingsState();
    const s2 = setVolume(s, 30);
    expect(s2.volume).toBe(30);
    expect(s.volume).toBe(80); // original intacto
    expect(setVolume(s, 200).volume).toBe(100);
  });

  it('toggles de música', () => {
    const s = initialSettingsState();
    expect(setMenuMusic(s, false).menuMusic).toBe(false);
    expect(setGameplayMusic(s, false).gameplayMusic).toBe(false);
    expect(s.menuMusic).toBe(true); // imutável
  });

  it('setLanguage: válido troca; inválido retorna a MESMA referência', () => {
    const s = initialSettingsState();
    expect(setLanguage(s, 'pt-BR').language).toBe('pt-BR');
    expect(setLanguage(s, 'xx')).toBe(s);
  });

  it('isSupportedLanguage', () => {
    expect(isSupportedLanguage('de')).toBe(true);
    expect(isSupportedLanguage('xx')).toBe(false);
  });
});
