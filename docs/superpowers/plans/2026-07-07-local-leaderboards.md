# Local Leaderboards (5.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist local best-per-mode match records (Endless/Daily/Weekly) and show them in a 3-tab Leaderboard screen; ranked by score.

**Architecture:** New global service `src/services/leaderboard/` in the established pure×shell mold (pure `store.ts` + injectable `storage.ts` + reactive `index.ts` singleton with `@preact/signals`), mirroring `trophy` (4.7). Recording is triggered on the existing `MatchController.onGameOver` edge in `startGame.ts`. UI is a `LeaderboardScreen` swapped into the existing `leaderboard` route. **No `src/core/` changes** — determinism stays 67.

**Tech Stack:** TypeScript (strict), Preact + `@preact/signals`, Vitest, i18next (10 locales), localStorage.

## Global Constraints

- **Determinismo (REGRA 1):** do NOT touch `src/core/`. Determinism must stay **67** (no golden re-pin).
- **i18n (REGRA 4):** no hardcoded user-visible strings — every new string is an i18next key present in **all 10 locales** (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`). Parity enforced by `tests/i18n/locales.test.ts`; AST scanner `tests/i18n/no-hardcoded-strings.test.ts`.
- **Performance (REGRA 3):** no per-frame work. Recording happens only on the `playing → dead` edge.
- **Arte trocável (REGRA 2/5):** icons are emoji (🥇/🥈/🥉/🏅) — no asset-spec.
- **Convenções:** TS estrito, sem `any` sem justificativa; `src/core/` não importa DOM/IO; tests live under `tests/services/<name>/` and `tests/` mirrors.
- **Naming (verbatim):** storage key `jurassicrun.leaderboard.v1`; `MAX_ENTRIES = 10`; modes `'endless' | 'daily' | 'weekly'`.

---

### Task 1: Pure store (`store.ts`)

**Files:**
- Create: `src/services/leaderboard/store.ts`
- Test: `tests/services/leaderboard/store.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type LeaderboardMode = 'endless' | 'daily' | 'weekly'`
  - `interface LeaderboardEntry { readonly seed: string; readonly score: number; readonly distance: number; readonly food: number; readonly nearMisses: number; readonly achievedAt: number }`
  - `interface LeaderboardResult { readonly mode: LeaderboardMode; readonly seed: string; readonly score: number; readonly distance: number; readonly food: number; readonly nearMisses: number; readonly level: number; readonly achievedAt: number }`
  - `interface LeaderboardState { readonly endless: readonly LeaderboardEntry[]; readonly daily: readonly LeaderboardEntry[]; readonly weekly: readonly LeaderboardEntry[]; readonly bestEndlessLevel: number }`
  - `const MAX_ENTRIES = 10`
  - `function initialLeaderboardState(): LeaderboardState`
  - `function sanitizeStat(n: number): number`
  - `function recordMatch(state: LeaderboardState, r: LeaderboardResult): LeaderboardState`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/leaderboard/store.test.ts
import { describe, it, expect } from 'vitest';
import {
  initialLeaderboardState,
  recordMatch,
  sanitizeStat,
  MAX_ENTRIES,
  type LeaderboardResult,
  type LeaderboardState,
} from '@services/leaderboard/store';

const result = (r: Partial<LeaderboardResult>): LeaderboardResult => ({
  mode: 'endless', seed: 'endless:AAAA', score: 0, distance: 0, food: 0,
  nearMisses: 0, level: 1, achievedAt: 1000, ...r,
});

describe('sanitizeStat', () => {
  it('floors to non-negative integer; NaN/negative/Infinity ⇒ 0', () => {
    expect(sanitizeStat(120.9)).toBe(120);
    expect(sanitizeStat(-4)).toBe(0);
    expect(sanitizeStat(NaN)).toBe(0);
    expect(sanitizeStat(Infinity)).toBe(0);
  });
});

describe('recordMatch — endless', () => {
  it('inserts and ranks by score desc (tie: achievedAt asc)', () => {
    let s: LeaderboardState = initialLeaderboardState();
    s = recordMatch(s, result({ seed: 'a', score: 10, achievedAt: 1 }));
    s = recordMatch(s, result({ seed: 'b', score: 30, achievedAt: 2 }));
    s = recordMatch(s, result({ seed: 'c', score: 30, achievedAt: 1 })); // tie, earlier wins
    expect(s.endless.map((e) => e.seed)).toEqual(['c', 'b', 'a']);
  });

  it('floors stored numbers', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ score: 45.9, distance: 120.7, food: 3, nearMisses: 2 }));
    expect(s.endless[0]).toMatchObject({ score: 45, distance: 120, food: 3, nearMisses: 2 });
  });

  it('keeps only the top MAX_ENTRIES', () => {
    let s = initialLeaderboardState();
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      s = recordMatch(s, result({ seed: `s${i}`, score: i, achievedAt: i }));
    }
    expect(s.endless).toHaveLength(MAX_ENTRIES);
    expect(s.endless[0]?.score).toBe(MAX_ENTRIES + 4); // highest
    expect(s.endless.at(-1)?.score).toBe(5); // lowest surviving
  });

  it('tracks bestEndlessLevel (max, lifetime, never evicted)', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ score: 5, level: 7 }));
    s = recordMatch(s, result({ score: 999, level: 3 }));
    expect(s.bestEndlessLevel).toBe(7);
  });
});

describe('recordMatch — daily/weekly dedup by seed', () => {
  it('keeps only the best score per seed (period)', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-07', score: 20, achievedAt: 1 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-07', score: 50, achievedAt: 2 }));
    s = recordMatch(s, result({ mode: 'daily', seed: 'daily:2026-07-08', score: 30, achievedAt: 3 }));
    expect(s.daily.map((e) => [e.seed, e.score])).toEqual([
      ['daily:2026-07-07', 50],
      ['daily:2026-07-08', 30],
    ]);
  });

  it('a worse attempt for an existing period returns the SAME state object', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'weekly', seed: 'weekly:2026-W28', score: 80 }));
    const before = s;
    const after = recordMatch(s, result({ mode: 'weekly', seed: 'weekly:2026-W28', score: 40 }));
    expect(after).toBe(before);
  });

  it('does not cross-contaminate modes', () => {
    let s = initialLeaderboardState();
    s = recordMatch(s, result({ mode: 'daily', seed: 'd', score: 10 }));
    expect(s.endless).toHaveLength(0);
    expect(s.weekly).toHaveLength(0);
    expect(s.daily).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/services/leaderboard/store.test.ts`
Expected: FAIL — module `@services/leaderboard/store` not found.

- [ ] **Step 3: Implement `store.ts`**

```ts
// src/services/leaderboard/store.ts
export type LeaderboardMode = 'endless' | 'daily' | 'weekly';

export interface LeaderboardEntry {
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly achievedAt: number;
}

/** Resultado de UMA partida a gravar (desacoplado de WorldState). */
export interface LeaderboardResult {
  readonly mode: LeaderboardMode;
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly level: number;
  readonly achievedAt: number;
}

export interface LeaderboardState {
  readonly endless: readonly LeaderboardEntry[];
  readonly daily: readonly LeaderboardEntry[];
  readonly weekly: readonly LeaderboardEntry[];
  readonly bestEndlessLevel: number;
}

export const MAX_ENTRIES = 10;

export function initialLeaderboardState(): LeaderboardState {
  return { endless: [], daily: [], weekly: [], bestEndlessLevel: 0 };
}

/** Saneia para inteiro não-negativo (NaN/negativo/∞/fração ⇒ floor ≥ 0). */
export function sanitizeStat(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function entryFromResult(r: LeaderboardResult): LeaderboardEntry {
  return {
    seed: r.seed,
    score: sanitizeStat(r.score),
    distance: sanitizeStat(r.distance),
    food: sanitizeStat(r.food),
    nearMisses: sanitizeStat(r.nearMisses),
    achievedAt: Number.isFinite(r.achievedAt) ? r.achievedAt : 0,
  };
}

/** Ordena por score desc; desempate achievedAt asc; depois seed (estabilidade total). */
function rank(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.achievedAt !== b.achievedAt) return a.achievedAt - b.achievedAt;
    return a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0;
  });
}

/** Endless: insere e trunca top-N. Sempre muda (nova ref). */
function insertRanked(list: readonly LeaderboardEntry[], entry: LeaderboardEntry): readonly LeaderboardEntry[] {
  return rank([...list, entry]).slice(0, MAX_ENTRIES);
}

/**
 * Diário/Semanal: dedup por seed (mantém maior score). Devolve a MESMA ref se a nova
 * entrada não superar o recorde já existente daquele período.
 */
function insertPeriodic(list: readonly LeaderboardEntry[], entry: LeaderboardEntry): readonly LeaderboardEntry[] {
  const existing = list.find((e) => e.seed === entry.seed);
  if (existing) {
    if (entry.score <= existing.score) return list; // não melhora ⇒ no-op
    const replaced = list.map((e) => (e.seed === entry.seed ? entry : e));
    return rank([...replaced]).slice(0, MAX_ENTRIES);
  }
  return rank([...list, entry]).slice(0, MAX_ENTRIES);
}

/** Grava um resultado no modo certo. Imutável. Mesma ref se nada mudou. */
export function recordMatch(state: LeaderboardState, r: LeaderboardResult): LeaderboardState {
  const entry = entryFromResult(r);
  if (r.mode === 'endless') {
    const level = sanitizeStat(r.level);
    return {
      ...state,
      endless: insertRanked(state.endless, entry),
      bestEndlessLevel: Math.max(state.bestEndlessLevel, level),
    };
  }
  const key = r.mode; // 'daily' | 'weekly'
  const nextList = insertPeriodic(state[key], entry);
  if (nextList === state[key]) return state; // no-op periódico ⇒ mesma ref
  return { ...state, [key]: nextList };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/services/leaderboard/store.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run check
git add src/services/leaderboard/store.ts tests/services/leaderboard/store.test.ts
git commit -m "feat(5.2): store puro de leaderboard (ranking por score + dedup periódico)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Storage (`storage.ts`)

**Files:**
- Create: `src/services/leaderboard/storage.ts`
- Test: `tests/services/leaderboard/storage.test.ts`

**Interfaces:**
- Consumes: `LeaderboardState`, `LeaderboardEntry`, `initialLeaderboardState`, `sanitizeStat` from `./store`.
- Produces:
  - `interface LeaderboardStorage { load(): LeaderboardState; save(state: LeaderboardState): void }`
  - `const STORAGE_KEY = 'jurassicrun.leaderboard.v1'`
  - `function memoryLeaderboardStorage(initial?: LeaderboardState): LeaderboardStorage`
  - `function localStorageLeaderboardStorage(): LeaderboardStorage`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/leaderboard/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { localStorageLeaderboardStorage, STORAGE_KEY } from '@services/leaderboard/storage';
import { initialLeaderboardState, type LeaderboardState } from '@services/leaderboard/store';

const sample: LeaderboardState = {
  endless: [{ seed: 'endless:X', score: 50, distance: 100, food: 2, nearMisses: 1, achievedAt: 123 }],
  daily: [],
  weekly: [],
  bestEndlessLevel: 4,
};

describe('localStorageLeaderboardStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a saved state', () => {
    const st = localStorageLeaderboardStorage();
    st.save(sample);
    expect(st.load()).toEqual(sample);
  });

  it('returns initial state when nothing stored', () => {
    expect(localStorageLeaderboardStorage().load()).toEqual(initialLeaderboardState());
  });

  it('returns initial state on invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(localStorageLeaderboardStorage().load()).toEqual(initialLeaderboardState());
  });

  it('drops malformed entries and sanitizes numbers', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      endless: [
        { seed: 'ok', score: 10.9, distance: 5, food: 1, nearMisses: 0, achievedAt: 9 },
        { seed: '', score: 5 },           // empty seed ⇒ dropped
        { score: 3 },                     // missing seed ⇒ dropped
        'garbage',                        // not an object ⇒ dropped
      ],
      daily: 'nope',                      // not an array ⇒ []
      weekly: [],
      bestEndlessLevel: -3,               // ⇒ 0
    }));
    const loaded = localStorageLeaderboardStorage().load();
    expect(loaded.endless).toEqual([
      { seed: 'ok', score: 10, distance: 5, food: 1, nearMisses: 0, achievedAt: 9 },
    ]);
    expect(loaded.daily).toEqual([]);
    expect(loaded.bestEndlessLevel).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/services/leaderboard/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `storage.ts`**

```ts
// src/services/leaderboard/storage.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/services/leaderboard/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run check
git add src/services/leaderboard/storage.ts tests/services/leaderboard/storage.test.ts
git commit -m "feat(5.2): storage localStorage robusto do leaderboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Reactive service (`index.ts`)

**Files:**
- Create: `src/services/leaderboard/index.ts`
- Test: `tests/services/leaderboard/index.test.ts`

**Interfaces:**
- Consumes: everything from `./store` and `./storage`.
- Produces:
  - `class LeaderboardService` with signals `endless`, `daily`, `weekly` (`ReadonlySignal<readonly LeaderboardEntry[]>`), `bestEndlessLevel` (`ReadonlySignal<number>`); methods `init(storage?: LeaderboardStorage): void`, `recordMatch(r: LeaderboardResult): void`.
  - `const leaderboardService = new LeaderboardService()`
  - Re-export types `LeaderboardEntry`, `LeaderboardMode`, `LeaderboardResult`, `LeaderboardStorage`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/leaderboard/index.test.ts
import { describe, it, expect } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { initialLeaderboardState, type LeaderboardResult } from '@services/leaderboard/store';

const result = (r: Partial<LeaderboardResult>): LeaderboardResult => ({
  mode: 'endless', seed: 'endless:AAAA', score: 0, distance: 0, food: 0,
  nearMisses: 0, level: 1, achievedAt: 1000, ...r,
});

describe('LeaderboardService', () => {
  it('records into the right signal and persists', () => {
    const storage = memoryLeaderboardStorage();
    const svc = new LeaderboardService();
    svc.init(storage);
    svc.recordMatch(result({ mode: 'daily', seed: 'daily:d', score: 42, level: 3 }));
    expect(svc.daily.value.map((e) => e.score)).toEqual([42]);
    expect(svc.endless.value).toHaveLength(0);
    // persisted
    expect(storage.load().daily.map((e) => e.score)).toEqual([42]);
  });

  it('exposes bestEndlessLevel reactively', () => {
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage());
    svc.recordMatch(result({ level: 6 }));
    expect(svc.bestEndlessLevel.value).toBe(6);
  });

  it('init loads existing state from storage', () => {
    const storage = memoryLeaderboardStorage({
      ...initialLeaderboardState(),
      bestEndlessLevel: 9,
    });
    const svc = new LeaderboardService();
    svc.init(storage);
    expect(svc.bestEndlessLevel.value).toBe(9);
  });

  it('does not persist a no-op periodic record', () => {
    let saves = 0;
    const base = memoryLeaderboardStorage();
    const storage = { load: base.load, save: (s: ReturnType<typeof base.load>) => { saves++; base.save(s); } };
    const svc = new LeaderboardService();
    svc.init(storage);
    svc.recordMatch(result({ mode: 'weekly', seed: 'w', score: 80 }));
    svc.recordMatch(result({ mode: 'weekly', seed: 'w', score: 20 })); // worse ⇒ no-op
    expect(saves).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/services/leaderboard/index.test.ts`
Expected: FAIL — `LeaderboardService` not found.

- [ ] **Step 3: Implement `index.ts`**

```ts
// src/services/leaderboard/index.ts
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialLeaderboardState,
  recordMatch as recordMatchState,
  type LeaderboardEntry,
  type LeaderboardResult,
  type LeaderboardState,
} from './store';
import {
  localStorageLeaderboardStorage,
  memoryLeaderboardStorage,
  type LeaderboardStorage,
} from './storage';

export class LeaderboardService {
  private storage: LeaderboardStorage = memoryLeaderboardStorage();
  private readonly _state = signal<LeaderboardState>(initialLeaderboardState());

  readonly endless: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.endless);
  readonly daily: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.daily);
  readonly weekly: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.weekly);
  readonly bestEndlessLevel: ReadonlySignal<number> = computed(() => this._state.value.bestEndlessLevel);

  init(storage: LeaderboardStorage = localStorageLeaderboardStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Registra o resultado de uma partida; persiste só se o estado mudou de ref. */
  recordMatch(r: LeaderboardResult): void {
    const next = recordMatchState(this._state.value, r);
    if (next === this._state.value) return; // no-op ⇒ nada a fazer
    this._state.value = next;
    this.storage.save(next);
  }
}

export const leaderboardService = new LeaderboardService();
export type { LeaderboardEntry, LeaderboardMode, LeaderboardResult } from './store';
export type { LeaderboardStorage } from './storage';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/services/leaderboard/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run check
git add src/services/leaderboard/index.ts tests/services/leaderboard/index.test.ts
git commit -m "feat(5.2): LeaderboardService reativo (sinais por modo + bestEndlessLevel)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire recording + bootstrap + Home maxLevel seam

**Files:**
- Modify: `src/app/game/startGame.ts` (add `leaderboardService.recordMatch(...)` inside existing `onGameOver`)
- Modify: `src/app/main.tsx` (add `leaderboardService.init()` next to the other service inits)
- Modify: `src/app/home/stats.ts` (`maxLevel` → `leaderboardService.bestEndlessLevel.value`)
- Test: `tests/app/home/stats.test.ts`

**Interfaces:**
- Consumes: `leaderboardService` from `@services/leaderboard`; `MatchMode` param and `match.seedLabel` (already in scope in `startGame`); `WorldState` fields `score`, `distance`, `food`, `nearMisses`, `level`, `alive`.
- Produces: `getHomeStats().maxLevel` now reflects `leaderboardService.bestEndlessLevel.value`.

- [ ] **Step 1: Write the failing test** (Home stats seam)

```ts
// tests/app/home/stats.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getHomeStats } from '../../../src/app/home/stats';
import { leaderboardService } from '@services/leaderboard';
import { walletService } from '@services/wallet';
import { trophyService } from '@services/trophy';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryWalletStorage } from '@services/wallet/storage';
import { memoryTrophyStorage } from '@services/trophy/storage';

describe('getHomeStats.maxLevel', () => {
  beforeEach(() => {
    walletService.init(memoryWalletStorage());
    trophyService.init(memoryTrophyStorage());
    leaderboardService.init(memoryLeaderboardStorage());
  });

  it('reflects leaderboard bestEndlessLevel', () => {
    expect(getHomeStats().maxLevel).toBe(0);
    leaderboardService.recordMatch({
      mode: 'endless', seed: 'endless:Z', score: 10, distance: 5,
      food: 0, nearMisses: 0, level: 8, achievedAt: 1,
    });
    expect(getHomeStats().maxLevel).toBe(8);
  });
});
```

> Note: confirm the exact `memoryWalletStorage`/`memoryTrophyStorage` export names by reading `src/services/wallet/storage.ts` and `src/services/trophy/storage.ts` before running; adjust the import if the helper is named differently.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/home/stats.test.ts`
Expected: FAIL — `maxLevel` is `1` (placeholder), not `0`/`8`.

- [ ] **Step 3: Update `stats.ts`**

Replace the import block and the `maxLevel` line:

```ts
import { walletService } from '@services/wallet';
import { trophyService } from '@services/trophy';
import { leaderboardService } from '@services/leaderboard';
```

```ts
export function getHomeStats(): HomeStats {
  return {
    coins: walletService.balance.value,
    trophies: trophyService.unlockedCount.value,
    maxLevel: leaderboardService.bestEndlessLevel.value,
  };
}
```

Also update the `maxLevel` doc comment in the `HomeStats` interface: change "ainda é placeholder — religa na Fase 5 (leaderboards)." to "vem do `leaderboardService.bestEndlessLevel` (item 5.2)."

- [ ] **Step 4: Wire recording in `startGame.ts`**

Add the import:

```ts
import { leaderboardService } from '@services/leaderboard';
```

Inside the existing `onGameOver: (w) => { ... }` callback, after the `trophyService.recordMatch({...})` call, add:

```ts
      leaderboardService.recordMatch({
        mode,
        seed: match.seedLabel,
        score: w.score,
        distance: w.distance,
        food: w.food,
        nearMisses: w.nearMisses,
        level: w.level,
        achievedAt: Date.now(),
      });
```

> `mode` is the `startGame` parameter; `match` is the `MatchController` in scope. If `match` is referenced before its `const match = ...` declaration, move the `leaderboardService.recordMatch` to read `match.seedLabel` — it runs only at game-over (well after construction), so the closure reference is valid; no reordering needed.

- [ ] **Step 5: Wire bootstrap in `main.tsx`**

Add the import near the other service imports:

```ts
import { leaderboardService } from '@services/leaderboard';
```

Add the init call right after `trophyService.init();`:

```ts
  leaderboardService.init();
```

- [ ] **Step 6: Run test + typecheck**

Run: `npm test -- tests/app/home/stats.test.ts`
Expected: PASS.
Run: `npm run check`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/game/startGame.ts src/app/main.tsx src/app/home/stats.ts tests/app/home/stats.test.ts
git commit -m "feat(5.2): grava partidas no leaderboard + religa maxLevel da Home

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Leaderboard screen + i18n (10 locales)

**Files:**
- Create: `src/app/screens/LeaderboardScreen.tsx`
- Modify: `src/app/App.tsx` (import + route case)
- Modify: `src/i18n/locales/{en,es,pt-BR,fr,it,de,ja,zh,ko,hi}.json` (add `leaderboard.*` keys)
- Modify: `src/app/styles/global.css` (append `.leaderboard*` styles)
- Test: `tests/app/screens/LeaderboardScreen.test.tsx`

**Interfaces:**
- Consumes: `leaderboardService` signals; `i18n.t`; `back` from `../router`.
- Produces: `LeaderboardScreen(): VNode`.

**i18n keys (add to ALL 10 locale JSONs under a new top-level `leaderboard` object).** English values:

```json
"leaderboard": {
  "title": "Leaderboard",
  "empty": "No records yet — play to set one!",
  "score": "Score",
  "distance": "Dist",
  "food": "Food",
  "nearMisses": "Near misses",
  "tab": { "endless": "Endless", "daily": "Daily", "weekly": "Weekly" }
}
```

Translate `title`, `empty`, `score`, `distance`, `food`, `nearMisses`, and the three `tab.*` values natively for each of `es, pt-BR, fr, it, de, ja, zh, ko, hi`. Reuse the existing `nav.back`. (Consult the `add-locale` skill for the native values; keep placeholders/proper-nouns per the 4.9 allowlist conventions — e.g. cognates like `Score`/`Endless` are legitimate identical-to-en values where they genuinely match.)

- [ ] **Step 1: Write the failing component test**

```tsx
// tests/app/screens/LeaderboardScreen.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { LeaderboardScreen } from '../../../src/app/screens/LeaderboardScreen';
import { i18n } from '@services/i18n';
import { leaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { initialLeaderboardState } from '@services/leaderboard/store';

describe('LeaderboardScreen', () => {
  beforeEach(async () => {
    await i18n.init();
    cleanup();
  });

  it('shows the empty state for a mode with no records', () => {
    leaderboardService.init(memoryLeaderboardStorage());
    const { getByText } = render(<LeaderboardScreen />);
    expect(getByText(i18n.t('leaderboard.empty'))).toBeTruthy();
  });

  it('lists endless entries ranked by score with medal for #1', () => {
    leaderboardService.init(memoryLeaderboardStorage({
      ...initialLeaderboardState(),
      endless: [
        { seed: 'endless:A', score: 90, distance: 200, food: 3, nearMisses: 1, achievedAt: 2 },
        { seed: 'endless:B', score: 40, distance: 80, food: 1, nearMisses: 0, achievedAt: 1 },
      ],
    }));
    const { getByText } = render(<LeaderboardScreen />);
    expect(getByText('90')).toBeTruthy();
    expect(getByText('40')).toBeTruthy();
    expect(getByText('🥇')).toBeTruthy();
  });
});
```

> Note: confirm the component-test runner setup by reading an existing screen test (e.g. `tests/app/screens/*.test.tsx` or the App smoke test) — match its imports (`@testing-library/preact` vs a local helper) and the `await Promise.resolve()` signals-flush gotcha noted in CLAUDE.md for happy-dom. Adjust imports to the repo's actual convention before running.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/screens/LeaderboardScreen.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Add the i18n keys to all 10 locales**

Add the `leaderboard` object (English above; native translations for the rest) to each `src/i18n/locales/*.json`. Keep the file's existing key order/style.

- [ ] **Step 4: Implement `LeaderboardScreen.tsx`**

```tsx
// src/app/screens/LeaderboardScreen.tsx
import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { leaderboardService, type LeaderboardEntry, type LeaderboardMode } from '@services/leaderboard';

const TABS: readonly LeaderboardMode[] = ['endless', 'daily', 'weekly'];
const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

function rankGlyph(index: number): string {
  return MEDALS[index] ?? `${index + 1}`;
}

function EntryRow({ entry, index }: { entry: LeaderboardEntry; index: number }): VNode {
  return (
    <li class="leaderboard__row" data-testid={`leaderboard-row-${index}`}>
      <span class="leaderboard__rank" aria-hidden={index < 3 ? 'true' : undefined}>
        {rankGlyph(index)}
      </span>
      <span class="leaderboard__score">{entry.score}</span>
      <span class="leaderboard__detail">
        {i18n.t('leaderboard.distance')}: {entry.distance} · {i18n.t('leaderboard.food')}: {entry.food}
      </span>
      <span class="leaderboard__seed">{entry.seed}</span>
    </li>
  );
}

function entriesFor(mode: LeaderboardMode): readonly LeaderboardEntry[] {
  if (mode === 'endless') return leaderboardService.endless.value;
  if (mode === 'daily') return leaderboardService.daily.value;
  return leaderboardService.weekly.value;
}

export function LeaderboardScreen(): VNode {
  const [tab, setTab] = useState<LeaderboardMode>('endless');
  const entries = entriesFor(tab);

  return (
    <div class="screen leaderboard">
      <h1 class="screen__title">{i18n.t('leaderboard.title')}</h1>

      <div class="leaderboard__tabs" role="tablist">
        {TABS.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={tab === m ? 'true' : 'false'}
            class={`leaderboard__tab${tab === m ? ' leaderboard__tab--active' : ''}`}
            data-testid={`leaderboard-tab-${m}`}
            onClick={() => setTab(m)}
          >
            {i18n.t(`leaderboard.tab.${m}`)}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p class="leaderboard__empty">{i18n.t('leaderboard.empty')}</p>
      ) : (
        <ol class="leaderboard__list">
          {entries.map((entry, index) => (
            <EntryRow key={`${entry.seed}-${entry.achievedAt}`} entry={entry} index={index} />
          ))}
        </ol>
      )}

      <button type="button" class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Swap the route in `App.tsx`**

Add the import next to the other screen imports:

```ts
import { LeaderboardScreen } from './screens/LeaderboardScreen';
```

Replace the `leaderboard` case:

```ts
    case 'leaderboard':
      return <LeaderboardScreen />;
```

- [ ] **Step 6: Add CSS to `global.css`**

Append (using existing design tokens — mirror `.trophies`/`.nest` spacing conventions already in the file; keep tab targets ≥ 44px, no hardcoded colors):

```css
.leaderboard__tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.leaderboard__tab {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
}
.leaderboard__tab--active {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
.leaderboard__list {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.leaderboard__row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  grid-template-areas: "rank score detail" "rank seed seed";
  align-items: center;
  gap: var(--space-1) var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.leaderboard__rank { grid-area: rank; font-size: 1.4em; min-width: 1.6em; text-align: center; }
.leaderboard__score { grid-area: score; font-weight: 700; font-size: 1.2em; }
.leaderboard__detail { grid-area: detail; opacity: 0.8; font-size: 0.85em; }
.leaderboard__seed { grid-area: seed; opacity: 0.6; font-size: 0.75em; }
.leaderboard__empty { opacity: 0.8; margin: var(--space-4) 0; }
```

> Note: confirm the exact custom-property names (`--space-*`, `--color-*`, `--radius-*`) by reading `src/app/styles/tokens.css`/`global.css` first; use the repo's actual token names. If a needed token is absent, reuse the nearest existing one used by `.trophies`.

- [ ] **Step 7: Run tests + full check**

Run: `npm test -- tests/app/screens/LeaderboardScreen.test.tsx`
Expected: PASS.
Run: `npm test` (full suite — i18n parity + no-hardcoded-strings must stay green)
Expected: PASS.
Run: `npm run check`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/screens/LeaderboardScreen.tsx src/app/App.tsx src/i18n/locales/ src/app/styles/global.css tests/app/screens/LeaderboardScreen.test.tsx
git commit -m "feat(5.2): tela de Leaderboard (3 abas) + i18n 10 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `npm test` — full suite green (new leaderboard tests + i18n parity + no-hardcoded-strings).
- [ ] `npm run check` — typecheck + lint clean.
- [ ] `npm run test:determinism` — **still 67**, unchanged (no `src/core/` touched).
- [ ] Update `docs/roadmap/PHASE-05-challenges-local.md`: mark 5.2 checkboxes `[x]`.
- [ ] Update `CLAUDE.md` "Estado atual" with the 5.2 summary; set next item to 5.3.
- [ ] Final branch review (reviewer subagent) → merge to `main` (`--no-ff`).
```
