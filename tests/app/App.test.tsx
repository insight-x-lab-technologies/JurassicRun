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

  it('renderiza daily como placeholder "em breve"', () => {
    render(<App />, container);
    navigate('daily');
    render(<App />, container);
    expect(container.textContent).toContain(i18n.t('screen.daily'));
    expect(container.textContent).toContain(i18n.t('screen.comingSoon'));
  });

  it('após navegar a um stub, mostra seu título e "em breve"', () => {
    render(<App />, container);
    navigate('settings');
    render(<App />, container); // re-render lê route.value corrente (flush determinístico)
    expect(container.textContent).toContain(i18n.t('screen.settings'));
    expect(container.textContent).toContain(i18n.t('screen.comingSoon'));
    expect(container.textContent).not.toContain(i18n.t('nav.play'));
  });
});
