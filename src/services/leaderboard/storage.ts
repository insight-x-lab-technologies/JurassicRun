import {
  initialLeaderboardState,
  sanitizeStat,
  type LeaderboardEntry,
  type LeaderboardState,
} from './store';

export interface LeaderboardStorage {
  load(): LeaderboardState;
  save(state: LeaderboardState): void;
}

export const STORAGE_KEY = 'jurassicrun.leaderboard.v1';

export function memoryLeaderboardStorage(
  initial: LeaderboardState = initialLeaderboardState(),
): LeaderboardStorage {
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

function num(raw: Record<string, unknown>, k: string): number {
  return typeof raw[k] === 'number' ? sanitizeStat(raw[k] as number) : 0;
}

function sanitizeEntry(raw: unknown): LeaderboardEntry | null {
  if (!isRecord(raw)) return null;
  const seed = raw.seed;
  if (typeof seed !== 'string' || seed.length === 0) return null;
  const achievedAt = typeof raw.achievedAt === 'number' && Number.isFinite(raw.achievedAt) ? raw.achievedAt : 0;
  return {
    seed,
    score: num(raw, 'score'),
    distance: num(raw, 'distance'),
    food: num(raw, 'food'),
    nearMisses: num(raw, 'nearMisses'),
    achievedAt,
  };
}

function sanitizeList(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeEntry).filter((e): e is LeaderboardEntry => e !== null);
}

function parseState(rawText: string): LeaderboardState {
  try {
    const data: unknown = JSON.parse(rawText);
    if (!isRecord(data)) return initialLeaderboardState();
    return {
      endless: sanitizeList(data.endless),
      daily: sanitizeList(data.daily),
      weekly: sanitizeList(data.weekly),
      bestEndlessLevel: num(data, 'bestEndlessLevel'),
    };
  } catch {
    return initialLeaderboardState();
  }
}

export function localStorageLeaderboardStorage(): LeaderboardStorage {
  return {
    load(): LeaderboardState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialLeaderboardState() : parseState(raw);
      } catch {
        return initialLeaderboardState();
      }
    },
    save(state: LeaderboardState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
