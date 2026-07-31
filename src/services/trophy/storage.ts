import { TROPHY_CATALOG } from './catalog';
import { emptyStats, initialTrophyState, sanitizeStat, type TrophyState, type TrophyStats } from './store';

export interface TrophyStorage {
  load(): TrophyState;
  save(state: TrophyState): void;
}

export const STORAGE_KEY = 'jurassicrun.trophies.v1';

export function memoryTrophyStorage(initial: TrophyState = initialTrophyState()): TrophyStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Varre as chaves do estado VAZIO (não uma lista fixa) — assim um campo novo em `TrophyStats`
 * nunca fica de fora do saneamento por esquecimento (guarda: teste de invariante em storage.test.ts).
 */
function sanitizeStats(raw: unknown): TrophyStats {
  const base = emptyStats();
  if (!isRecord(raw)) return base;
  const out: Record<string, number> = {};
  for (const key of Object.keys(base)) {
    const v = raw[key];
    out[key] = typeof v === 'number' ? sanitizeStat(v) : 0;
  }
  return out as unknown as TrophyStats;
}

function knownId(id: unknown): id is string {
  return typeof id === 'string' && TROPHY_CATALOG.some((t) => t.id === id);
}

function parseState(rawText: string): TrophyState {
  try {
    const data: unknown = JSON.parse(rawText);
    if (!isRecord(data)) return initialTrophyState();
    const unlockedRaw = Array.isArray(data.unlocked) ? data.unlocked : [];
    const unlocked = unlockedRaw.filter(knownId);
    return { stats: sanitizeStats(data.stats), unlocked };
  } catch {
    return initialTrophyState();
  }
}

export function localStorageTrophyStorage(): TrophyStorage {
  return {
    load(): TrophyState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialTrophyState() : parseState(raw);
      } catch {
        return initialTrophyState();
      }
    },
    save(state: TrophyState): void {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          // A CHAVE continua `.v1` de propósito: bumpar apagaria desbloqueios conquistados.
          // Só o schema do payload avança (10.7). Campos ausentes num payload v1 lêem 0.
          JSON.stringify({ version: 2, stats: state.stats, unlocked: state.unlocked }),
        );
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
