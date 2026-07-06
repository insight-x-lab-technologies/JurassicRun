// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { SettingsScreen } from '@app/screens/SettingsScreen';
import { i18n } from '@services/i18n';
import { settingsService } from '@services/settings';
import { memorySettingsStorage } from '@services/settings/storage';

describe('SettingsScreen', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    await i18n.init();
    await settingsService.init(memorySettingsStorage());
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<SettingsScreen />, container);
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renderiza os 4 controles', () => {
    expect(container.querySelector('[data-testid="settings-volume"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="settings-menu-music"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="settings-gameplay-music"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="settings-language"]')).not.toBeNull();
  });

  it('trocar o volume atualiza o serviço', () => {
    const slider = container.querySelector('[data-testid="settings-volume"]') as HTMLInputElement;
    slider.value = '20';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(settingsService.volume.value).toBe(20);
  });

  it('trocar o idioma no select troca o idioma ativo do i18n', async () => {
    const select = container.querySelector('[data-testid="settings-language"]') as HTMLSelectElement;
    select.value = 'de';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    // 3 ticks: instance.changeLanguage() resolve -> applyLanguage() continuation -> setLanguage() continuation (commit).
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(i18n.getLanguage()).toBe('de');
    expect(settingsService.language.value).toBe('de');
  });
});
