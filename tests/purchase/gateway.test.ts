import { describe, expect, it } from 'vitest';
import { memoryRedemptionGateway, unavailableGateway } from '@services/purchase/gateway';

describe('unavailableGateway', () => {
  it('não está disponível e recusa', async () => {
    expect(unavailableGateway.available.value).toBe(false);
    expect(await unavailableGateway.redeem('X')).toEqual({ ok: false, reason: 'error' });
  });
});

describe('memoryRedemptionGateway', () => {
  it('resgata um código conhecido uma única vez', async () => {
    const g = memoryRedemptionGateway({ GOLD: 'coins:medium' });
    expect(g.available.value).toBe(true);
    expect(await g.redeem('GOLD')).toEqual({ ok: true, sku: 'coins:medium' });
    expect(await g.redeem('GOLD')).toEqual({ ok: false, reason: 'used' });
  });
  it('recusa código desconhecido', async () => {
    const g = memoryRedemptionGateway({});
    expect(await g.redeem('NOPE')).toEqual({ ok: false, reason: 'invalid' });
  });
});
