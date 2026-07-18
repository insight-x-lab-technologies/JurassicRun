// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { RedeemCodeForm } from '@app/purchase/RedeemCodeForm';
import { purchaseService } from '@services/purchase';
import { memoryRedemptionGateway } from '@services/purchase/gateway';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';
import { i18n } from '@services/i18n';

function setInput(el: Element | null, value: string): void {
  const input = el as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function submitForm(container: HTMLElement): void {
  container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
const tick = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('RedeemCodeForm', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    await i18n.init();
    walletService.init(memoryWalletStorage());
    entitlementsService.init(memoryEntitlementsStorage());
    purchaseService.init({ gateway: memoryRedemptionGateway({ GOLD: 'coins:medium' }) });
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<RedeemCodeForm />, container);
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('resgata um código válido e mostra sucesso', async () => {
    setInput(container.querySelector('[data-testid="redeem-input"]'), 'GOLD');
    submitForm(container);
    await tick();
    expect(container.querySelector('[data-testid="redeem-status"]')?.textContent).toBe(
      i18n.t('purchase.result.ok'),
    );
  });

  it('código inválido mostra erro de inválido', async () => {
    setInput(container.querySelector('[data-testid="redeem-input"]'), 'NOPE');
    submitForm(container);
    await tick();
    expect(container.querySelector('[data-testid="redeem-status"]')?.textContent).toBe(
      i18n.t('purchase.result.invalid'),
    );
  });
});
