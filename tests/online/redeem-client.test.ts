import { describe, expect, it } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';

describe('memoryOnlineClient.redeemCode', () => {
  it('devolve a resposta programada e registra a chamada', async () => {
    const c = memoryOnlineClient({ redeemResponses: { GOLD: { ok: true, sku: 'coins:large' } } });
    expect(await c.redeemCode('GOLD')).toEqual({ ok: true, sku: 'coins:large' });
    expect(c.redeemCalls).toEqual(['GOLD']);
  });
  it('código sem resposta programada ⇒ invalid', async () => {
    const c = memoryOnlineClient({});
    expect(await c.redeemCode('NOPE')).toEqual({ ok: false, reason: 'invalid' });
  });
});
