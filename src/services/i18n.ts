import i18next, { type i18n as I18nInstance } from 'i18next';
import {
  resources,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  type SupportedLanguage,
} from '@i18n/locales/index';

function isSupported(lng: string): lng is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);
}

class I18nService {
  private instance: I18nInstance = i18next.createInstance();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.instance.init({
      resources,
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES as readonly string[] as string[],
      defaultNS: 'translation',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    this.initialized = true;
  }

  t(key: string, options?: Record<string, unknown>): string {
    if (options !== undefined) {
      return this.instance.t(key, options);
    }
    return this.instance.t(key);
  }

  async changeLanguage(lng: string): Promise<void> {
    if (!isSupported(lng)) return;
    await this.instance.changeLanguage(lng);
  }

  getLanguage(): string {
    return this.instance.language;
  }

  readonly supportedLanguages = SUPPORTED_LANGUAGES;
}

export const i18n = new I18nService();
export { SUPPORTED_LANGUAGES };
