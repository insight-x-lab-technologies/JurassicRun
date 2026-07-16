import { describe, it, expect } from 'vitest';
import { memoryTrophyOnline } from '@services/trophy/online';

describe('memoryTrophyOnline', () => {
  it('registra submitted e devolve trophies', async () => {
    const o = memoryTrophyOnline({ online: true, trophies: ['forager'] });
    await o.submitTrophies(['centurion']);
    expect(o.submitted).toEqual([['centurion']]);
    expect(await o.fetchTrophies()).toEqual(['forager']);
    expect(o.online.value).toBe(true);
  });

  it('setOnline alterna o sinal', () => {
    const o = memoryTrophyOnline();
    expect(o.online.value).toBe(false);
    o.setOnline(true);
    expect(o.online.value).toBe(true);
  });
});
