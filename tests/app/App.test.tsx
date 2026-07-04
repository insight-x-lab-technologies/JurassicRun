// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { App } from '@app/App';
import { resetToHome, navigate } from '@app/router';
import { i18n } from '@services/i18n';

describe('App shell', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    resetToHome();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container); // desmonta
    container.remove();
  });

  it('renderiza a Home com título e botão Jogar', () => {
    render(<App />, container);
    expect(container.textContent).toContain(i18n.t('app.title'));
    expect(container.textContent).toContain(i18n.t('nav.play'));
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
