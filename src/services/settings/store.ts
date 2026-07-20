import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from '@i18n/locales/index';
import { DEFAULT_FONT, isFontChoice, type FontChoice } from './fonts';

export interface SettingsState {
  readonly volume: number; // inteiro 0..100
  readonly menuMusic: boolean;
  readonly gameplayMusic: boolean;
  readonly language: SupportedLanguage;
  readonly font: FontChoice;
}

export function initialSettingsState(): SettingsState {
  return {
    volume: 80,
    menuMusic: true,
    gameplayMusic: true,
    language: DEFAULT_LANGUAGE,
    font: DEFAULT_FONT,
  };
}

/** Clampa a [0,100] e arredonda; NaN ⇒ 0, +∞ ⇒ 100. */
export function sanitizeVolume(v: number): number {
  if (Number.isNaN(v)) return 0;
  const rounded = Math.round(v);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

export function isSupportedLanguage(lng: string): lng is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);
}

export function setVolume(s: SettingsState, v: number): SettingsState {
  return { ...s, volume: sanitizeVolume(v) };
}

export function setMenuMusic(s: SettingsState, on: boolean): SettingsState {
  return { ...s, menuMusic: on };
}

export function setGameplayMusic(s: SettingsState, on: boolean): SettingsState {
  return { ...s, gameplayMusic: on };
}

/** Idioma inválido ⇒ retorna a MESMA referência (no-op). */
export function setLanguage(s: SettingsState, lng: string): SettingsState {
  if (!isSupportedLanguage(lng)) return s;
  return { ...s, language: lng };
}

/** Fonte inválida ⇒ retorna a MESMA referência (no-op), espelhando setLanguage. */
export function setFont(s: SettingsState, font: string): SettingsState {
  if (!isFontChoice(font)) return s;
  return { ...s, font };
}
