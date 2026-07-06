import { initialEntitlementsState, type EntitlementsState } from './store';
import { DEFAULT_EXPANSION_ID, expansionById } from './catalog';

export interface EntitlementsStorage {
  load(): EntitlementsState;
  save(state: EntitlementsState): void;
}

export const STORAGE_KEY = 'jurassicrun.entitlements.v1';

export function memoryEntitlementsStorage(
  initial: EntitlementsState = initialEntitlementsState(),
): EntitlementsStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function sanitize(unlocked: readonly string[], activeId: unknown): EntitlementsState {
  // só ids conhecidos; DEFAULT sempre desbloqueado; activeId resolve p/ um desbloqueado.
  const known = unlocked.filter((id) => expansionById(id) !== undefined);
  const set = new Set<string>([DEFAULT_EXPANSION_ID, ...known]);
  const unlockedArr = [...set];
  const active =
    typeof activeId === 'string' && unlockedArr.includes(activeId) ? activeId : DEFAULT_EXPANSION_ID;
  return { unlocked: unlockedArr, activeId: active };
}

function parseState(raw: string): EntitlementsState {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return initialEntitlementsState();
    const d = data as Record<string, unknown>;
    const unlocked = Array.isArray(d.unlocked)
      ? d.unlocked.filter((x): x is string => typeof x === 'string')
      : [];
    return sanitize(unlocked, d.activeId);
  } catch {
    return initialEntitlementsState();
  }
}

export function localStorageEntitlementsStorage(): EntitlementsStorage {
  return {
    load(): EntitlementsState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialEntitlementsState() : parseState(raw);
      } catch {
        return initialEntitlementsState();
      }
    },
    save(state: EntitlementsState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
