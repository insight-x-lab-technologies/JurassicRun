// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { App } from '@app/App';
import { resetToHome, navigate } from '@app/router';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

describe('App shell', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    resetToHome();
    profileService.init(memoryProfileStorage(emptyState()));
    profileService.create('Tester');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container); // desmonta
    container.remove();
  });

  it('renderiza a Home (perfil ativo + botão Novo Jogo)', () => {
    render(<App />, container);
    expect(container.textContent).toContain('Tester');
    expect(container.textContent).toContain(i18n.t('home.newGame'));
  });

  it('após navegar a outra rota, mostra a tela correspondente', () => {
    render(<App />, container);
    navigate('shop');
    render(<App />, container); // re-render lê route.value corrente (flush determinístico)
    expect(container.textContent).toContain(i18n.t('shop.title'));
    expect(container.textContent).not.toContain(i18n.t('nav.play'));
  });

  it('após navegar à leaderboard, mostra a tela real de classificação (3 abas)', () => {
    render(<App />, container);
    navigate('leaderboard');
    render(<App />, container); // re-render lê route.value corrente (flush determinístico)
    expect(container.textContent).toContain(i18n.t('leaderboard.title'));
    expect(container.querySelector('[data-testid="leaderboard-tab-endless"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="leaderboard-tab-daily"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="leaderboard-tab-weekly"]')).not.toBeNull();
    expect(container.textContent).not.toContain(i18n.t('nav.play'));
  });
});
