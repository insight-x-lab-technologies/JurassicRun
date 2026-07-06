// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { ExpansionsScreen } from '@app/screens/ExpansionsScreen';
import { i18n } from '@services/i18n';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';

function click(el: Element | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('ExpansionsScreen', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    await i18n.init();
    entitlementsService.init(memoryEntitlementsStorage());
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<ExpansionsScreen />, container);
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('mostra o selo Ativo na expansão default e botão Unlock nas premium', () => {
    expect(container.querySelector('[data-testid="expansion-active-classic"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="expansion-unlock-volcano"]')).not.toBeNull();
  });

  it('unlock (honor-system) troca o card para Select', async () => {
    click(container.querySelector('[data-testid="expansion-unlock-volcano"]'));
    await Promise.resolve(); // flush do signal (gotcha happy-dom)
    expect(entitlementsService.unlockedIds.value).toContain('volcano');
    expect(container.querySelector('[data-testid="expansion-select-volcano"]')).not.toBeNull();
  });

  it('select ativa a expansão desbloqueada', async () => {
    entitlementsService.unlock('volcano');
    render(<ExpansionsScreen />, container);
    click(container.querySelector('[data-testid="expansion-select-volcano"]'));
    await Promise.resolve();
    expect(entitlementsService.activeExpansion.value.id).toBe('volcano');
  });
});
