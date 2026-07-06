import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialSettingsState,
  setVolume,
  setMenuMusic,
  setGameplayMusic,
  setLanguage,
  type SettingsState,
} from './store';
import {
  localStorageSettingsStorage,
  memorySettingsStorage,
  type SettingsStorage,
} from './storage';
import { i18n } from '@services/i18n';

class SettingsService {
  private storage: SettingsStorage = memorySettingsStorage();
  private readonly _state = signal<SettingsState>(initialSettingsState());

  readonly volume: ReadonlySignal<number> = computed(() => this._state.value.volume);
  readonly menuMusic: ReadonlySignal<boolean> = computed(() => this._state.value.menuMusic);
  readonly gameplayMusic: ReadonlySignal<boolean> = computed(() => this._state.value.gameplayMusic);
  readonly language: ReadonlySignal<string> = computed(() => this._state.value.language);

  async init(storage: SettingsStorage = localStorageSettingsStorage()): Promise<void> {
    this.storage = storage;
    const state = storage.load();
    this._state.value = state;
    await this.applyLanguage(state.language);
  }

  setVolume(v: number): void {
    this.commit(setVolume(this._state.value, v));
  }

  setMenuMusic(on: boolean): void {
    this.commit(setMenuMusic(this._state.value, on));
  }

  setGameplayMusic(on: boolean): void {
    this.commit(setGameplayMusic(this._state.value, on));
  }

  /** Troca o idioma: aplica no i18n ANTES de comitar o sinal (para o re-render já ler as strings novas). */
  async setLanguage(lng: string): Promise<void> {
    const next = setLanguage(this._state.value, lng);
    if (next === this._state.value) return; // idioma inválido: no-op
    await this.applyLanguage(next.language);
    this.commit(next);
  }

  private async applyLanguage(lng: string): Promise<void> {
    await i18n.changeLanguage(lng);
    document.documentElement.lang = i18n.getLanguage();
    document.title = i18n.t('app.title');
  }

  private commit(state: SettingsState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const settingsService = new SettingsService();
export type { SettingsStorage } from './storage';
