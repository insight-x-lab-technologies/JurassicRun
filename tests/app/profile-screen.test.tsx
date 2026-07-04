// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { ProfileScreen } from '@app/screens/ProfileScreen';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

describe('ProfileScreen', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    profileService.init(memoryProfileStorage(emptyState()));
    profileService.create('Rex');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('mostra o nome do jogador ativo', () => {
    render(<ProfileScreen />, container);
    expect(container.textContent).toContain('Rex');
    expect(container.textContent).toContain(i18n.t('profile.active'));
  });

  it('criar um novo jogador o adiciona e o torna ativo', async () => {
    render(<ProfileScreen />, container);
    const createInput = container.querySelector<HTMLInputElement>('[data-testid="create-input"]')!;
    createInput.value = 'Ptero';
    createInput.dispatchEvent(new Event('input', { bubbles: true }));
    container
      .querySelector<HTMLFormElement>('[data-testid="create-form"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    render(<ProfileScreen />, container);
    expect(profileService.profiles.value).toHaveLength(2);
    expect(profileService.activeProfile.value!.name).toBe('Ptero');
  });

  it('tocar um perfil não-ativo troca o ativo', async () => {
    profileService.create('Ptero'); // Ptero vira ativo
    render(<ProfileScreen />, container);
    // botão de troca do perfil 'Rex' (o não-ativo)
    const rexBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Rex') && b.hasAttribute('data-switch'),
    )!;
    rexBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    render(<ProfileScreen />, container);
    expect(profileService.activeProfile.value!.name).toBe('Rex');
  });

  it('trocar de perfil resincroniza o campo de renomear (não fica com o nome antigo)', async () => {
    profileService.create('Ptero'); // Ptero vira ativo
    render(<ProfileScreen />, container);
    // botão de troca do perfil 'Rex' (o não-ativo)
    const rexBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Rex') && b.hasAttribute('data-switch'),
    )!;
    rexBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    render(<ProfileScreen />, container);
    // useEffect roda depois do "paint" (preact agenda via rAF/setTimeout, não microtask):
    // um Promise.resolve() não basta para flushar o efeito de resync.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const renameInput = container.querySelector<HTMLInputElement>('[data-testid="rename-input"]')!;
    expect(renameInput.value).toBe('Rex');
  });

  it('renomear atualiza o nome do ativo', async () => {
    render(<ProfileScreen />, container);
    const renameInput = container.querySelector<HTMLInputElement>('[data-testid="rename-input"]')!;
    renameInput.value = 'RexII';
    renameInput.dispatchEvent(new Event('input', { bubbles: true }));
    container
      .querySelector<HTMLFormElement>('[data-testid="rename-form"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    render(<ProfileScreen />, container);
    expect(profileService.activeProfile.value!.name).toBe('RexII');
  });
});
