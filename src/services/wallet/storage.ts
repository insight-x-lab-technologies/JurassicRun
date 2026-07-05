import { initialWalletState, type WalletState } from './store';

export interface WalletStorage {
  load(): WalletState;
  save(state: WalletState): void;
}

export const STORAGE_KEY = 'jurassicrun.wallet.v1';

export function memoryWalletStorage(initial: WalletState = initialWalletState()): WalletStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function parseState(raw: string): WalletState {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return initialWalletState();
    const coins = (data as Record<string, unknown>).coins;
    if (typeof coins !== 'number' || !Number.isFinite(coins) || coins < 0) return initialWalletState();
    return { coins: Math.floor(coins) };
  } catch {
    return initialWalletState();
  }
}

export function localStorageWalletStorage(): WalletStorage {
  return {
    load(): WalletState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialWalletState() : parseState(raw);
      } catch {
        return initialWalletState();
      }
    },
    save(state: WalletState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, coins: state.coins }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
