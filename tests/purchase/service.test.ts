import { describe, expect, it } from 'vitest';
import { purchaseService } from '@services/purchase';
import { memoryRedemptionGateway, unavailableGateway } from '@services/purchase/gateway';

function fakes() {
  const coins: number[] = [];
  const expansions: string[] = [];
  return {
    coins, expansions,
    wallet: { earn: (n: number) => coins.push(n) },
    entitlements: { grantAndSelect: (id: string) => expansions.push(id) },
  };
}

describe('purchaseService.redeem', () => {
  it('aplica coins de um SKU válido', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ A: 'coins:medium' }), wallet: f.wallet, entitlements: f.entitlements });
    const r = await purchaseService.redeem('A');
    expect(r).toEqual({ status: 'ok', sku: 'coins:medium' });
    expect(f.coins).toEqual([500]);
    expect(f.expansions).toEqual([]);
  });

  it('aplica expansão de um SKU válido', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ B: 'expansion:glacier' }), wallet: f.wallet, entitlements: f.entitlements });
    expect(await purchaseService.redeem('B')).toEqual({ status: 'ok', sku: 'expansion:glacier' });
    expect(f.expansions).toEqual(['glacier']);
  });

  it('código usado ⇒ used, sem aplicar', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ C: 'coins:small' }), wallet: f.wallet, entitlements: f.entitlements });
    await purchaseService.redeem('C');
    const r = await purchaseService.redeem('C');
    expect(r.status).toBe('used');
    expect(f.coins).toEqual([100]); // só a 1ª aplicou
  });

  it('código desconhecido ⇒ invalid', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({}), wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('Z')).status).toBe('invalid');
  });

  it('SKU desconhecido vindo do servidor ⇒ error, sem aplicar', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ D: 'coins:huge' }), wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('D')).status).toBe('error');
    expect(f.coins).toEqual([]);
  });

  it('código vazio ⇒ invalid sem chamar o gateway', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ '': 'coins:small' }), wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('  ')).status).toBe('invalid');
    expect(f.coins).toEqual([]);
  });

  it('gateway indisponível ⇒ unavailable', async () => {
    const f = fakes();
    purchaseService.init({ gateway: unavailableGateway, wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('A')).status).toBe('unavailable');
  });

  it('available reflete o gateway', () => {
    purchaseService.init({ gateway: unavailableGateway });
    expect(purchaseService.available.value).toBe(false);
    purchaseService.init({ gateway: memoryRedemptionGateway({}) });
    expect(purchaseService.available.value).toBe(true);
  });
});
