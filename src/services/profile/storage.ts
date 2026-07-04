import { emptyState, type Profile, type ProfileState } from './store';

export interface ProfileStorage {
  load(): ProfileState;
  save(state: ProfileState): void;
}

export const STORAGE_KEY = 'jurassicrun.profiles.v1';

export function memoryProfileStorage(initial: ProfileState = emptyState()): ProfileStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'number'
  );
}

function parseState(raw: string): ProfileState {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) return emptyState();
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.profiles) || !d.profiles.every(isProfile)) return emptyState();
  const profiles = d.profiles as Profile[];
  // Se o activeId persistido não resolve mas há perfis, cai no primeiro em vez
  // de null — evita forçar re-onboarding (com perfis existentes) sob storage corrompido.
  const activeId =
    typeof d.activeId === 'string' && profiles.some((p) => p.id === d.activeId)
      ? d.activeId
      : (profiles[0]?.id ?? null);
  return { profiles, activeId };
}

export function localStorageProfileStorage(): ProfileStorage {
  return {
    load(): ProfileState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return emptyState();
        return parseState(raw);
      } catch {
        return emptyState();
      }
    },
    save(state: ProfileState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
