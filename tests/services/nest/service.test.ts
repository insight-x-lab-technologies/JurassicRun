import { describe, it, expect, beforeEach } from 'vitest';
import { nestService } from '@services/nest';
import { memoryNestStorage } from '@services/nest/storage';
import { STARTER_DINO_ID, DINO_ROSTER } from '@services/nest/roster';
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';

describe('NestService', () => {
  beforeEach(() => {
    nestService.init(memoryNestStorage());
  });

  it('inicia com o starter ativo e possuído', () => {
    expect(nestService.activeDino.value.id).toBe(STARTER_DINO_ID);
    expect(nestService.ownedIds.value).toContain(STARTER_DINO_ID);
    expect(nestService.activeTrait()).toBe('none');
  });

  it('buy com saldo 0 (seam) falha para dinos pagos', () => {
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    expect(nestService.buy(paid.id)).toBe('insufficient');
    expect(nestService.ownedIds.value).not.toContain(paid.id);
  });

  it('select só ativa dino possuído e persiste', () => {
    const storage = memoryNestStorage();
    nestService.init(storage);
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    nestService.select(paid.id); // não possuído ⇒ no-op
    expect(nestService.activeDino.value.id).toBe(STARTER_DINO_ID);
    // possuído (força via storage) persiste na seleção
    storage.save({ owned: [STARTER_DINO_ID, paid.id], activeId: STARTER_DINO_ID });
    nestService.init(storage);
    nestService.select(paid.id);
    expect(nestService.activeDino.value.id).toBe(paid.id);
    expect(storage.load().activeId).toBe(paid.id);
  });

  it('buy debits the wallet and grants the dino when affordable', () => {
    walletService.init(memoryWalletStorage({ coins: 1000 }));
    nestService.init(memoryNestStorage());
    const result = nestService.buy('goldbeak'); // price 150
    expect(result).toBe('ok');
    expect(walletService.balance.value).toBe(850);
    expect(nestService.ownedIds.value).toContain('goldbeak');
  });

  it('buy with insufficient balance neither debits nor grants', () => {
    walletService.init(memoryWalletStorage({ coins: 10 }));
    nestService.init(memoryNestStorage());
    const result = nestService.buy('goldbeak');
    expect(result).toBe('insufficient');
    expect(walletService.balance.value).toBe(10);
    expect(nestService.ownedIds.value).not.toContain('goldbeak');
  });
});
