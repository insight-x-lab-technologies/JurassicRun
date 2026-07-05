import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialWalletState,
  addCoins,
  spendCoins,
  type WalletState,
} from './store';
import { localStorageWalletStorage, memoryWalletStorage, type WalletStorage } from './storage';

class WalletService {
  private storage: WalletStorage = memoryWalletStorage();
  private readonly _state = signal<WalletState>(initialWalletState());

  readonly balance: ReadonlySignal<number> = computed(() => this._state.value.coins);

  init(storage: WalletStorage = localStorageWalletStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Credita moedas (ganho de partida ou pacote da Loja) e persiste. */
  earn(amount: number): void {
    this.commit(addCoins(this._state.value, amount));
  }

  /** Debita moedas; retorna false (sem persistir) se o saldo não cobre. */
  spend(amount: number): boolean {
    const { state, ok } = spendCoins(this._state.value, amount);
    if (ok) this.commit(state);
    return ok;
  }

  private commit(state: WalletState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const walletService = new WalletService();
export { coinsForFood } from './store';
export type { WalletStorage } from './storage';
