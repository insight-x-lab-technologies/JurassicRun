// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { HomeScreen } from '@app/screens/HomeScreen';
import { route, resetToHome } from '@app/router';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

function click(el: Element | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('HomeScreen', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    await i18n.init();
    resetToHome();
    profileService.init(memoryProfileStorage(emptyState()));
    profileService.create('Rex');
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<HomeScreen />, container);
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('mostra nome do perfil ativo e os 3 chips de stats', () => {
    expect(container.textContent).toContain('Rex');
    expect(container.textContent).toContain(i18n.t('home.coins'));
    expect(container.textContent).toContain(i18n.t('home.trophies'));
    expect(container.textContent).toContain(i18n.t('home.level'));
  });

  it('clicar em Novo Jogo navega para play', () => {
    click(
      [...container.querySelectorAll('button')].find(
        (b) => b.textContent === i18n.t('home.newGame'),
      )!,
    );
    expect(route.value).toBe('play');
  });

  it('clicar na identidade navega para o perfil', () => {
    click(container.querySelector('[data-testid="home-identity"]'));
    expect(route.value).toBe('profile');
  });

  it('renderiza os itens de menu de navegação', () => {
    const txt = container.textContent ?? '';
    for (const key of [
      'nav.daily',
      'nav.weekly',
      'nav.nest',
      'nav.shop',
      'nav.expansions',
      'nav.leaderboard',
      'nav.settings',
      'nav.share',
      'nav.donate',
    ]) {
      expect(txt).toContain(i18n.t(key));
    }
  });
});
