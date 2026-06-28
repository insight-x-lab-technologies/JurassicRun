import en from './en.json';
import es from './es.json';
import ptBR from './pt-BR.json';
import fr from './fr.json';
import it from './it.json';
import de from './de.json';
import ja from './ja.json';
import zh from './zh.json';
import ko from './ko.json';
import hi from './hi.json';

export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'pt-BR',
  'fr',
  'it',
  'de',
  'ja',
  'zh',
  'ko',
  'hi',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const resources: Record<SupportedLanguage, { translation: Record<string, unknown> }> = {
  en: { translation: en },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
  fr: { translation: fr },
  it: { translation: it },
  de: { translation: de },
  ja: { translation: ja },
  zh: { translation: zh },
  ko: { translation: ko },
  hi: { translation: hi },
};
