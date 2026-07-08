import {
  initialReplayState,
  sanitizeStat,
  MAX_REPLAYS,
  type ReplayMode,
  type ReplayState,
  type StoredReplay,
} from './store';

export interface ReplayStorage {
  load(): ReplayState;
  save(state: ReplayState): void;
}

export const STORAGE_KEY = 'jurassicrun.replays.v1';

export function memoryReplayStorage(initial: ReplayState = initialReplayState()): ReplayStorage {
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

function sanitizeTimeline(raw: unknown): readonly boolean[] | null {
  if (!Array.isArray(raw)) return null;
  if (!raw.every((v) => typeof v === 'boolean')) return null;
  return raw as boolean[];
}

function sanitizeReplay(raw: unknown, mode: ReplayMode): StoredReplay | null {
  if (!isRecord(raw)) return null;
  const seed = raw.seed;
  if (typeof seed !== 'string' || seed.length === 0) return null;
  const timeline = sanitizeTimeline(raw.timeline);
  if (timeline === null) return null;
  const finalHash = raw.finalHash;
  if (typeof finalHash !== 'string' || finalHash.length === 0) return null;
  const achievedAt =
    typeof raw.achievedAt === 'number' && Number.isFinite(raw.achievedAt) ? raw.achievedAt : 0;
  return {
    mode,
    seed,
    timeline,
    score: num(raw, 'score'),
    distance: num(raw, 'distance'),
    food: num(raw, 'food'),
    nearMisses: num(raw, 'nearMisses'),
    finalHash,
    achievedAt,
  };
}

function sanitizeList(raw: unknown, mode: ReplayMode): StoredReplay[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => sanitizeReplay(r, mode))
    .filter((r): r is StoredReplay => r !== null)
    .slice(0, MAX_REPLAYS);
}

function parseState(rawText: string): ReplayState {
  try {
    const data: unknown = JSON.parse(rawText);
    if (!isRecord(data)) return initialReplayState();
    return {
      daily: sanitizeList(data.daily, 'daily'),
      weekly: sanitizeList(data.weekly, 'weekly'),
    };
  } catch {
    return initialReplayState();
  }
}

export function localStorageReplayStorage(): ReplayStorage {
  return {
    load(): ReplayState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialReplayState() : parseState(raw);
      } catch {
        return initialReplayState();
      }
    },
    save(state: ReplayState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
