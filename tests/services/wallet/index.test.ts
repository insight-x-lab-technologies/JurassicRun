import { describe, it, expect, beforeEach } from 'vitest';
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';

describe('WalletService', () => {
  beforeEach(() => walletService.init(memoryWalletStorage({ coins: 0 })));

  it('loads initial balance from storage', () => {
    walletService.init(memoryWalletStorage({ coins: 50 }));
    expect(walletService.balance.value).toBe(50);
  });

  it('earn adds coins and persists', () => {
    const storage = memoryWalletStorage({ coins: 0 });
    walletService.init(storage);
    walletService.earn(30);
    expect(walletService.balance.value).toBe(30);
    expect(storage.load()).toEqual({ coins: 30 });
  });

  it('spend debits and returns true when affordable', () => {
    walletService.init(memoryWalletStorage({ coins: 100 }));
    expect(walletService.spend(40)).toBe(true);
    expect(walletService.balance.value).toBe(60);
  });

  it('spend returns false and keeps balance when insufficient', () => {
    const storage = memoryWalletStorage({ coins: 10 });
    walletService.init(storage);
    expect(walletService.spend(50)).toBe(false);
    expect(walletService.balance.value).toBe(10);
    expect(storage.load()).toEqual({ coins: 10 });
  });
});
