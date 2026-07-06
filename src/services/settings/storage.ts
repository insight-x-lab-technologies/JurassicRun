import {
  initialSettingsState,
  sanitizeVolume,
  isSupportedLanguage,
  type SettingsState,
} from './store';

export interface SettingsStorage {
  load(): SettingsState;
  save(state: SettingsState): void;
}

export const STORAGE_KEY = 'jurassicrun.settings.v1';

export function memorySettingsStorage(initial: SettingsState = initialSettingsState()): SettingsStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

export function parseState(raw: string): SettingsState {
  const base = initialSettingsState();
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return base;
    const d = data as Record<string, unknown>;
    const volume = typeof d.volume === 'number' ? sanitizeVolume(d.volume) : base.volume;
    const menuMusic = typeof d.menuMusic === 'boolean' ? d.menuMusic : base.menuMusic;
    const gameplayMusic = typeof d.gameplayMusic === 'boolean' ? d.gameplayMusic : base.gameplayMusic;
    const language =
      typeof d.language === 'string' && isSupportedLanguage(d.language) ? d.language : base.language;
    return { volume, menuMusic, gameplayMusic, language };
  } catch {
    return base;
  }
}

export function localStorageSettingsStorage(): SettingsStorage {
  return {
    load(): SettingsState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialSettingsState() : parseState(raw);
      } catch {
        return initialSettingsState();
      }
    },
    save(state: SettingsState): void {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, ...state }),
        );
      } catch {
        // storage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
