// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { App } from '@app/App';
import { resetToHome } from '@app/router';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

describe('Onboarding (primeiro acesso)', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    resetToHome();
    profileService.init(memoryProfileStorage(emptyState()));
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('sem perfil, o App mostra o onboarding (não a Home)', () => {
    render(<App />, container);
    expect(container.textContent).toContain(i18n.t('onboarding.prompt'));
    expect(container.textContent).not.toContain(i18n.t('nav.play'));
  });

  it('submeter nome válido cria o perfil e revela a Home', () => {
    render(<App />, container);
    const input = container.querySelector('input')!;
    input.value = 'Rex';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = container.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    render(<App />, container);
    expect(profileService.activeProfile.value?.name).toBe('Rex');
    expect(container.textContent).toContain(i18n.t('home.newGame'));
  });

  it('nome vazio mostra erro e não cria perfil', async () => {
    render(<App />, container);
    const form = container.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // `@preact/signals` corrige (patch global) `Component.prototype.shouldComponentUpdate`
    // assim que é importado em qualquer módulo (aqui: `route`/`profileService`) — isso vale
    // para TODO componente da árvore, mesmo os que não leem nenhum signal (como
    // OnboardingScreen). Um `useState` local então só se reflete de fato de volta na
    // árvore quando o próprio flush assíncrono do Preact roda (a chamada manual de
    // `render()` sozinha, sem ceder ao microtask, encontra o componente ainda "sujo" e
    // não repinta) — daí o `await` de 1 tick antes de re-renderizar e checar o DOM.
    await Promise.resolve();
    render(<App />, container);
    expect(container.textContent).toContain(i18n.t('onboarding.error.empty'));
    expect(profileService.activeProfile.value).toBeNull();
  });
});
