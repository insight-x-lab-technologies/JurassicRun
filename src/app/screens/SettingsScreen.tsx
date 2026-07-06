import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { settingsService } from '@services/settings';
import { SUPPORTED_LANGUAGES, LANGUAGE_NATIVE_NAMES } from '@i18n/locales/index';

export function SettingsScreen(): VNode {
  const volume = settingsService.volume.value;
  const menuMusic = settingsService.menuMusic.value;
  const gameplayMusic = settingsService.gameplayMusic.value;
  const language = settingsService.language.value;

  return (
    <div class="screen settings">
      <h1 class="screen__title">{i18n.t('settings.title')}</h1>

      <label class="settings__row" for="settings-volume">
        <span class="settings__label">{i18n.t('settings.volume')}</span>
        <input
          id="settings-volume"
          data-testid="settings-volume"
          class="settings__slider"
          type="range"
          min={0}
          max={100}
          value={volume}
          onInput={(e) => settingsService.setVolume((e.currentTarget as HTMLInputElement).valueAsNumber)}
        />
        <span class="settings__value" aria-hidden="true">{volume}</span>
      </label>

      <label class="settings__row" for="settings-menu-music">
        <span class="settings__label">{i18n.t('settings.menuMusic')}</span>
        <input
          id="settings-menu-music"
          data-testid="settings-menu-music"
          type="checkbox"
          class="settings__toggle"
          checked={menuMusic}
          onChange={(e) => settingsService.setMenuMusic((e.currentTarget as HTMLInputElement).checked)}
        />
        <span class="settings__state" aria-hidden="true">
          {i18n.t(menuMusic ? 'settings.on' : 'settings.off')}
        </span>
      </label>

      <label class="settings__row" for="settings-gameplay-music">
        <span class="settings__label">{i18n.t('settings.gameplayMusic')}</span>
        <input
          id="settings-gameplay-music"
          data-testid="settings-gameplay-music"
          type="checkbox"
          class="settings__toggle"
          checked={gameplayMusic}
          onChange={(e) => settingsService.setGameplayMusic((e.currentTarget as HTMLInputElement).checked)}
        />
        <span class="settings__state" aria-hidden="true">
          {i18n.t(gameplayMusic ? 'settings.on' : 'settings.off')}
        </span>
      </label>

      <label class="settings__row" for="settings-language">
        <span class="settings__label">{i18n.t('settings.language')}</span>
        <select
          id="settings-language"
          data-testid="settings-language"
          class="settings__select"
          value={language}
          onChange={(e) => void settingsService.setLanguage((e.currentTarget as HTMLSelectElement).value)}
        >
          {SUPPORTED_LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>
              {LANGUAGE_NATIVE_NAMES[lng]}
            </option>
          ))}
        </select>
      </label>

      <button type="button" class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('settings.back')}
      </button>
    </div>
  );
}
