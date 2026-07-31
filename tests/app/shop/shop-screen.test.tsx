// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { ShopScreen } from '@app/screens/ShopScreen';
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';
import { purchaseService } from '@services/purchase';
import { memoryRedemptionGateway } from '@services/purchase/gateway';
import { i18n } from '@services/i18n';
import { COIN_PACKS } from '@app/shop/packs';
import { checkoutUrlFor, storefront } from '@services/purchase/storefront';

let opened: string[] = [];

function mount(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(<ShopScreen openDeps={{ openUrl: (u) => opened.push(u) }} />, container);
  return container;
}

describe('ShopScreen', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    opened = [];
    await i18n.init();
    walletService.init(memoryWalletStorage());
    entitlementsService.init(memoryEntitlementsStorage());
    purchaseService.init({ gateway: memoryRedemptionGateway({ GOLD: 'coins:medium' }) });
    container = mount();
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('clicar em qualquer pacote NÃO credita moeda e abre o checkout do SKU certo', () => {
    const before = walletService.balance.value;
    for (const pack of COIN_PACKS) {
      const btn = container.querySelector(`[data-testid="shop-buy-${pack.id}"]`) as HTMLButtonElement;
      btn.click();
      expect(walletService.balance.value).toBe(before);
    }
    expect(opened).toEqual(COIN_PACKS.map((p) => checkoutUrlFor(storefront(), p.sku)));
  });

  it('cada pacote mostra um preço em dinheiro e o código do SKU', () => {
    for (const pack of COIN_PACKS) {
      const price = container.querySelector(`[data-testid="shop-price-${pack.id}"]`);
      expect(price?.textContent?.trim()).not.toBe('');
      expect(price?.textContent).toMatch(/\d/);
      expect(container.querySelector(`[data-testid="shop-sku-${pack.id}"]`)?.textContent).toContain(
        pack.sku,
      );
    }
  });

  it('as três seções coexistem com gateway disponível', () => {
    expect(container.querySelector('[data-testid="shop-balance"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shop-packs"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="redeem-input"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="redeem-offline"]')).toBeNull();
  });

  it('cita as fontes gratuitas de moeda', () => {
    const free = container.querySelector('[data-testid="shop-free"]')?.textContent ?? '';
    expect(free).toContain(i18n.t('shop.freePlay'));
    expect(free).toContain(i18n.t('shop.freeChallenges'));
  });

  it('não mostra mais nenhum botão de "adicionar" moeda', () => {
    for (const pack of COIN_PACKS) {
      expect(container.querySelector(`[data-testid="shop-grant-${pack.id}"]`)).toBeNull();
    }
  });
});

describe('ShopScreen sem gateway', () => {
  let container: HTMLDivElement;
  beforeEach(async () => {
    opened = [];
    await i18n.init();
    walletService.init(memoryWalletStorage());
    entitlementsService.init(memoryEntitlementsStorage());
    purchaseService.init({}); // gateway indisponível
    container = mount();
  });
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('mantém as três seções e desabilita só o resgate', () => {
    expect(container.querySelector('[data-testid="shop-balance"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="shop-packs"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="redeem-offline"]')).not.toBeNull();
    const buy = container.querySelector(
      `[data-testid="shop-buy-${COIN_PACKS[0]!.id}"]`,
    ) as HTMLButtonElement;
    expect(buy.disabled).toBe(false); // comprar no Ko-fi não depende do nosso servidor
  });
});
