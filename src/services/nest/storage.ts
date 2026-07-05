import { initialNestState, type NestState } from './store';
import { dinoById, STARTER_DINO_ID } from './roster';

export interface NestStorage {
  load(): NestState;
  save(state: NestState): void;
}

export const STORAGE_KEY = 'jurassicrun.nest.v1';

export function memoryNestStorage(initial: NestState = initialNestState()): NestStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function sanitize(owned: readonly string[], activeId: unknown): NestState {
  // só ids conhecidos; starter sempre possuído; activeId resolve para um possuído.
  const known = owned.filter((id) => dinoById(id) !== undefined);
  const set = new Set<string>([STARTER_DINO_ID, ...known]);
  const ownedArr = [...set];
  const active =
    typeof activeId === 'string' && ownedArr.includes(activeId) ? activeId : STARTER_DINO_ID;
  return { owned: ownedArr, activeId: active };
}

function parseState(raw: string): NestState {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return initialNestState();
    const d = data as Record<string, unknown>;
    const owned = Array.isArray(d.owned)
      ? d.owned.filter((x): x is string => typeof x === 'string')
      : [];
    return sanitize(owned, d.activeId);
  } catch {
    return initialNestState();
  }
}

export function localStorageNestStorage(): NestStorage {
  return {
    load(): NestState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialNestState() : parseState(raw);
      } catch {
        return initialNestState();
      }
    },
    save(state: NestState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
