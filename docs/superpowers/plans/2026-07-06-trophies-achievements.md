# Troféus / Conquistas (4.7) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um `TrophyService` global reativo com um catálogo de conquistas desbloqueadas pelo desempenho nas partidas, persistido offline, com contagem real na Home e uma tela de Troféus.

**Architecture:** Serviço puro×casca em `src/services/trophy/` (molde de `wallet`/`nest`/`entitlements`): `store.ts` puro (fold de estatísticas + avaliação de predicados), `catalog.ts` (defs + condições puras), `storage.ts` (localStorage injetável), `index.ts` (singleton reativo com `@preact/signals`). Fiação no `onGameOver` existente do `MatchController` (via `startGame`), no seam `getHomeStats`, numa nova rota `trophies` e numa `TrophiesScreen`. **`src/core/` não é tocado** ⇒ determinismo (67) intacto.

**Tech Stack:** TypeScript estrito, `@preact/signals`, Preact (JSX via oxc), Vitest + happy-dom, i18next (10 locales).

## Global Constraints

- **Determinismo:** NÃO tocar `src/core/`. Nenhum `Math.random`/`Date.now` dentro de `src/core/`. Este item vive todo fora do core. Determinismo esperado: **67 testes, inalterado**.
- **i18n (REGRA 4):** nenhuma string visível hardcoded. Toda chave nova entra nos **10 locales** (`en, es, pt-BR, fr, it, de, ja, zh, ko, hi`), com `en` primeiro. Paridade verificada por `tests/i18n/locales.test.ts`.
- **TypeScript estrito:** sem `any` sem justificativa. `exactOptionalPropertyTypes` ativo (construir objetos com props opcionais condicionalmente).
- **Padrão de serviço:** singleton exportado, sinais `ReadonlySignal`, `init(storage?)` síncrono, `commit()` = set-sinal + persist. `Date.now()`/`crypto` só na casca (aqui nem são necessários).
- **Verificação:** `npm run check` limpo e `npm test` verde antes de fechar. Comando de teste focado: `npx vitest run <arquivo>`.
- **Ícones = emoji** resolvidos na UI (sem asset-spec; consistente com StatChips).
- Um commit por task na branch `feat/4.7-trophies`. Mensagens em pt-BR, terminando com a linha `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

- `src/services/trophy/catalog.ts` — `TrophyDef`, `TROPHY_CATALOG`, `trophyById`. (Task 1)
- `src/services/trophy/store.ts` — `MatchSummary`, `TrophyStats`, `TrophyState`, `foldMatch`, `evaluate`, `recordMatch`. (Task 1)
- `src/services/trophy/storage.ts` — `TrophyStorage`, `memoryTrophyStorage`, `localStorageTrophyStorage`. (Task 2)
- `src/services/trophy/index.ts` — `TrophyService` singleton + reexports. (Task 3)
- `src/app/game/startGame.ts` — modificar `onGameOver`. (Task 4)
- `src/app/main.tsx` — `trophyService.init()`. (Task 4)
- `src/app/home/stats.ts` — religar `trophies`. (Task 4)
- `src/app/router/routes.ts` — `'trophies'` no union. (Task 4)
- `src/app/App.tsx` — case `trophies`. (Task 4)
- `src/app/screens/HomeScreen.tsx` — chip 🏆 vira botão. (Task 4)
- `src/app/screens/TrophiesScreen.tsx` — nova tela. (Task 5)
- `src/app/styles/global.css` — regras `.trophies`/`.trophy-card`. (Task 5)
- `src/i18n/locales/*.json` — chaves novas (10 arquivos). (Task 4 para `nav/screen`; Task 5 para `trophy.*`/`trophies.*`)
- Testes: `tests/services/trophy/{store,storage,index}.test.ts`, `tests/app/home/stats.test.ts` (modificar), `tests/app/screens/TrophiesScreen.test.tsx`.

> Path aliases: `@services/*` → `src/services/*`, `@i18n/*` → `src/i18n/*`, `@core/*` → `src/core/*`. Confirme em `tests/` como os existentes importam (ex.: `tests/services/wallet/*`).

---

### Task 1: Núcleo puro — catálogo + store

**Files:**
- Create: `src/services/trophy/catalog.ts`
- Create: `src/services/trophy/store.ts`
- Test: `tests/services/trophy/store.test.ts`

**Interfaces:**
- Produces:
  - `interface TrophyStats { readonly gamesPlayed: number; readonly totalFood: number; readonly totalDistance: number; readonly bestDistance: number; readonly bestNearMisses: number; readonly bestScore: number; }`
  - `interface MatchSummary { readonly distance: number; readonly food: number; readonly nearMisses: number; readonly score: number; }`
  - `interface TrophyState { readonly stats: TrophyStats; readonly unlocked: readonly string[]; }`
  - `interface TrophyDef { readonly id: string; readonly nameKey: string; readonly descKey: string; readonly condition: (s: TrophyStats) => boolean; }`
  - `const TROPHY_CATALOG: readonly TrophyDef[]`
  - `function trophyById(id: string): TrophyDef | undefined`
  - `function emptyStats(): TrophyStats`
  - `function initialTrophyState(): TrophyState`
  - `function foldMatch(stats: TrophyStats, m: MatchSummary): TrophyStats`
  - `function evaluate(state: TrophyState): { state: TrophyState; newlyUnlocked: readonly string[] }`
  - `function recordMatch(state: TrophyState, m: MatchSummary): { state: TrophyState; newlyUnlocked: readonly string[] }`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/services/trophy/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  emptyStats,
  initialTrophyState,
  foldMatch,
  evaluate,
  recordMatch,
  type MatchSummary,
} from '@services/trophy/store';
import { TROPHY_CATALOG, trophyById } from '@services/trophy/catalog';

const match = (m: Partial<MatchSummary>): MatchSummary => ({
  distance: 0, food: 0, nearMisses: 0, score: 0, ...m,
});

describe('foldMatch', () => {
  it('incrementa cumulativos e faz max dos melhores', () => {
    const s0 = emptyStats();
    const s1 = foldMatch(s0, match({ distance: 120.9, food: 3, nearMisses: 2, score: 45.7 }));
    expect(s1).toEqual({
      gamesPlayed: 1, totalFood: 3, totalDistance: 120,
      bestDistance: 120, bestNearMisses: 2, bestScore: 45,
    });
    const s2 = foldMatch(s1, match({ distance: 50, food: 10, nearMisses: 5, score: 20 }));
    expect(s2).toEqual({
      gamesPlayed: 2, totalFood: 13, totalDistance: 170,
      bestDistance: 120, bestNearMisses: 5, bestScore: 45,
    });
  });

  it('saneia entradas inválidas (NaN/negativo ⇒ 0) e não muta a entrada', () => {
    const s0 = emptyStats();
    const s1 = foldMatch(s0, match({ distance: NaN, food: -4, nearMisses: -1, score: -9 }));
    expect(s1).toEqual({
      gamesPlayed: 1, totalFood: 0, totalDistance: 0,
      bestDistance: 0, bestNearMisses: 0, bestScore: 0,
    });
    expect(s0).toEqual(emptyStats());
  });
});

describe('evaluate', () => {
  it('desbloqueia firstFlight após a 1ª partida e é idempotente', () => {
    const st = { stats: foldMatch(emptyStats(), match({})), unlocked: [] };
    const r1 = evaluate(st);
    expect(r1.newlyUnlocked).toEqual(['firstFlight']);
    expect(r1.state.unlocked).toContain('firstFlight');
    const r2 = evaluate(r1.state);
    expect(r2.newlyUnlocked).toEqual([]);
    expect(r2.state).toBe(r1.state); // mesmo objeto quando nada muda
  });

  it('não desbloqueia conquista cuja condição ainda não bate', () => {
    const st = { stats: emptyStats(), unlocked: [] };
    expect(evaluate(st).newlyUnlocked).toEqual([]);
  });
});

describe('recordMatch', () => {
  it('destrava centurion quando bestDistance cruza 1000', () => {
    let st = initialTrophyState();
    st = recordMatch(st, match({ distance: 999 })).state;
    expect(st.unlocked).not.toContain('centurion');
    const r = recordMatch(st, match({ distance: 1000 }));
    expect(r.newlyUnlocked).toContain('centurion');
    expect(r.state.unlocked).toContain('centurion');
  });

  it('destrava persistent na 25ª partida', () => {
    let st = initialTrophyState();
    for (let i = 0; i < 24; i++) st = recordMatch(st, match({})).state;
    expect(st.unlocked).not.toContain('persistent');
    const r = recordMatch(st, match({}));
    expect(r.newlyUnlocked).toContain('persistent');
  });
});

describe('catálogo', () => {
  it('tem ids únicos e trophyById resolve/rejeita', () => {
    const ids = TROPHY_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(trophyById('firstFlight')?.id).toBe('firstFlight');
    expect(trophyById('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/trophy/store.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar `catalog.ts`**

```ts
import type { TrophyStats } from './store';

/** Uma conquista: predicado puro sobre o agregado vitalício. Ícone = emoji na UI. */
export interface TrophyDef {
  readonly id: string;
  readonly nameKey: string;
  readonly descKey: string;
  readonly condition: (s: TrophyStats) => boolean;
}

/** Catálogo inicial. Limiares são placeholders (tuning Fase 8). */
export const TROPHY_CATALOG: readonly TrophyDef[] = Object.freeze([
  { id: 'firstFlight', nameKey: 'trophy.firstFlight.name', descKey: 'trophy.firstFlight.desc',
    condition: (s) => s.gamesPlayed >= 1 },
  { id: 'centurion', nameKey: 'trophy.centurion.name', descKey: 'trophy.centurion.desc',
    condition: (s) => s.bestDistance >= 1000 },
  { id: 'forager', nameKey: 'trophy.forager.name', descKey: 'trophy.forager.desc',
    condition: (s) => s.totalFood >= 50 },
  { id: 'daredevil', nameKey: 'trophy.daredevil.name', descKey: 'trophy.daredevil.desc',
    condition: (s) => s.bestNearMisses >= 10 },
  { id: 'marathoner', nameKey: 'trophy.marathoner.name', descKey: 'trophy.marathoner.desc',
    condition: (s) => s.totalDistance >= 10000 },
  { id: 'highRoller', nameKey: 'trophy.highRoller.name', descKey: 'trophy.highRoller.desc',
    condition: (s) => s.bestScore >= 5000 },
  { id: 'persistent', nameKey: 'trophy.persistent.name', descKey: 'trophy.persistent.desc',
    condition: (s) => s.gamesPlayed >= 25 },
]);

export function trophyById(id: string): TrophyDef | undefined {
  return TROPHY_CATALOG.find((t) => t.id === id);
}
```

- [ ] **Step 4: Implementar `store.ts`**

```ts
import { TROPHY_CATALOG } from './catalog';

/** Agregado vitalício. Todos inteiros ≥ 0. */
export interface TrophyStats {
  readonly gamesPlayed: number;
  readonly totalFood: number;
  readonly totalDistance: number;
  readonly bestDistance: number;
  readonly bestNearMisses: number;
  readonly bestScore: number;
}

/** Resultado de UMA partida (desacoplado de WorldState). */
export interface MatchSummary {
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly score: number;
}

export interface TrophyState {
  readonly stats: TrophyStats;
  readonly unlocked: readonly string[];
}

export function emptyStats(): TrophyStats {
  return {
    gamesPlayed: 0, totalFood: 0, totalDistance: 0,
    bestDistance: 0, bestNearMisses: 0, bestScore: 0,
  };
}

export function initialTrophyState(): TrophyState {
  return { stats: emptyStats(), unlocked: [] };
}

/** Saneia para inteiro não-negativo (NaN/negativo/fração ⇒ floor≥0). */
export function sanitizeStat(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Dobra uma partida no agregado. Imutável; não muta a entrada. */
export function foldMatch(stats: TrophyStats, m: MatchSummary): TrophyStats {
  const distance = sanitizeStat(m.distance);
  const food = sanitizeStat(m.food);
  const nearMisses = sanitizeStat(m.nearMisses);
  const score = sanitizeStat(m.score);
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    totalFood: stats.totalFood + food,
    totalDistance: stats.totalDistance + distance,
    bestDistance: Math.max(stats.bestDistance, distance),
    bestNearMisses: Math.max(stats.bestNearMisses, nearMisses),
    bestScore: Math.max(stats.bestScore, score),
  };
}

/** Desbloqueia toda conquista satisfeita e ainda-não-desbloqueada. Mesmo objeto se nada muda. */
export function evaluate(state: TrophyState): { state: TrophyState; newlyUnlocked: readonly string[] } {
  const newlyUnlocked: string[] = [];
  for (const def of TROPHY_CATALOG) {
    if (!state.unlocked.includes(def.id) && def.condition(state.stats)) {
      newlyUnlocked.push(def.id);
    }
  }
  if (newlyUnlocked.length === 0) return { state, newlyUnlocked };
  return { state: { ...state, unlocked: [...state.unlocked, ...newlyUnlocked] }, newlyUnlocked };
}

/** Dobra a partida e reavalia. Imutável. */
export function recordMatch(state: TrophyState, m: MatchSummary): { state: TrophyState; newlyUnlocked: readonly string[] } {
  return evaluate({ stats: foldMatch(state.stats, m), unlocked: state.unlocked });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/services/trophy/store.test.ts`
Expected: PASS (todos verdes).

- [ ] **Step 6: Commit**

```bash
git add src/services/trophy/catalog.ts src/services/trophy/store.ts tests/services/trophy/store.test.ts
git commit -m "feat(4.7): núcleo puro de troféus (catálogo + foldMatch/evaluate/recordMatch)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Persistência (localStorage injetável)

**Files:**
- Create: `src/services/trophy/storage.ts`
- Test: `tests/services/trophy/storage.test.ts`

**Interfaces:**
- Consumes: `TrophyState`, `initialTrophyState`, `sanitizeStat`, `emptyStats` de `./store`; `TROPHY_CATALOG` de `./catalog`.
- Produces:
  - `interface TrophyStorage { load(): TrophyState; save(state: TrophyState): void; }`
  - `const STORAGE_KEY = 'jurassicrun.trophies.v1'`
  - `function memoryTrophyStorage(initial?: TrophyState): TrophyStorage`
  - `function localStorageTrophyStorage(): TrophyStorage`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/services/trophy/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { localStorageTrophyStorage, memoryTrophyStorage, STORAGE_KEY } from '@services/trophy/storage';
import { initialTrophyState, type TrophyState } from '@services/trophy/store';

const sample: TrophyState = {
  stats: { gamesPlayed: 3, totalFood: 12, totalDistance: 900, bestDistance: 400, bestNearMisses: 4, bestScore: 88 },
  unlocked: ['firstFlight'],
};

describe('memoryTrophyStorage', () => {
  it('faz round-trip', () => {
    const s = memoryTrophyStorage();
    s.save(sample);
    expect(s.load()).toEqual(sample);
  });
});

describe('localStorageTrophyStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trip via localStorage', () => {
    const s = localStorageTrophyStorage();
    s.save(sample);
    expect(localStorageTrophyStorage().load()).toEqual(sample);
  });

  it('sem dado salvo ⇒ estado inicial', () => {
    expect(localStorageTrophyStorage().load()).toEqual(initialTrophyState());
  });

  it('JSON inválido ⇒ estado inicial', () => {
    localStorage.setItem(STORAGE_KEY, '{nope');
    expect(localStorageTrophyStorage().load()).toEqual(initialTrophyState());
  });

  it('filtra ids desconhecidos de unlocked e saneia stats inválidos', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      stats: { gamesPlayed: -2, totalFood: 5.9, totalDistance: NaN, bestDistance: 10, bestNearMisses: 'x', bestScore: 3 },
      unlocked: ['firstFlight', 'ghost', 42],
    }));
    const loaded = localStorageTrophyStorage().load();
    expect(loaded.unlocked).toEqual(['firstFlight']);
    expect(loaded.stats).toEqual({
      gamesPlayed: 0, totalFood: 5, totalDistance: 0, bestDistance: 10, bestNearMisses: 0, bestScore: 3,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/trophy/storage.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `storage.ts`**

```ts
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

function sanitizeStats(raw: unknown): TrophyStats {
  const base = emptyStats();
  if (!isRecord(raw)) return base;
  const num = (k: keyof TrophyStats): number =>
    typeof raw[k] === 'number' ? sanitizeStat(raw[k] as number) : 0;
  return {
    gamesPlayed: num('gamesPlayed'),
    totalFood: num('totalFood'),
    totalDistance: num('totalDistance'),
    bestDistance: num('bestDistance'),
    bestNearMisses: num('bestNearMisses'),
    bestScore: num('bestScore'),
  };
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
          JSON.stringify({ version: 1, stats: state.stats, unlocked: state.unlocked }),
        );
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/services/trophy/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/trophy/storage.ts tests/services/trophy/storage.test.ts
git commit -m "feat(4.7): persistência de troféus (localStorage v1 + parseState robusto)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `TrophyService` reativo

**Files:**
- Create: `src/services/trophy/index.ts`
- Test: `tests/services/trophy/index.test.ts`

**Interfaces:**
- Consumes: `TrophyState`, `initialTrophyState`, `recordMatch`, `MatchSummary` de `./store`; `TrophyStorage`, `memoryTrophyStorage`, `localStorageTrophyStorage` de `./storage`.
- Produces:
  - `const trophyService: TrophyService` (singleton)
  - `trophyService.unlockedIds: ReadonlySignal<readonly string[]>`
  - `trophyService.unlockedCount: ReadonlySignal<number>`
  - `trophyService.init(storage?: TrophyStorage): void`
  - `trophyService.recordMatch(m: MatchSummary): readonly string[]` (retorna newlyUnlocked)
  - Reexports: `TROPHY_CATALOG`, `trophyById`, `type TrophyDef`, `type MatchSummary`, `type TrophyStorage`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/services/trophy/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TrophyService } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';
import { initialTrophyState } from '@services/trophy/store';

// Nota: TrophyService é exportado (a classe) além do singleton, para testar isolado.
describe('TrophyService', () => {
  it('recordMatch atualiza sinais, retorna newlyUnlocked e persiste', () => {
    const storage = memoryTrophyStorage();
    const svc = new TrophyService();
    svc.init(storage);
    expect(svc.unlockedCount.value).toBe(0);

    const newly = svc.recordMatch({ distance: 1200, food: 0, nearMisses: 0, score: 0 });
    expect(newly).toEqual(expect.arrayContaining(['firstFlight', 'centurion']));
    expect(svc.unlockedCount.value).toBe(newly.length);
    expect(svc.unlockedIds.value).toContain('centurion');

    // persistiu: uma nova instância carregando o mesmo storage vê o estado.
    const svc2 = new TrophyService();
    svc2.init(storage);
    expect(svc2.unlockedIds.value).toContain('centurion');
  });

  it('recordMatch sem novos desbloqueios não cresce a contagem', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage());
    svc.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 }); // firstFlight
    const before = svc.unlockedCount.value;
    const newly = svc.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 });
    expect(newly).toEqual([]);
    expect(svc.unlockedCount.value).toBe(before);
  });

  it('init sem arg parte de estado vazio (memory default)', () => {
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(initialTrophyState()));
    expect(svc.unlockedIds.value).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/trophy/index.test.ts`
Expected: FAIL (`TrophyService` não exportado).

- [ ] **Step 3: Implementar `index.ts`**

```ts
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialTrophyState,
  recordMatch as recordMatchState,
  type MatchSummary,
  type TrophyState,
} from './store';
import { localStorageTrophyStorage, memoryTrophyStorage, type TrophyStorage } from './storage';

export class TrophyService {
  private storage: TrophyStorage = memoryTrophyStorage();
  private readonly _state = signal<TrophyState>(initialTrophyState());

  readonly unlockedIds: ReadonlySignal<readonly string[]> = computed(() => this._state.value.unlocked);
  readonly unlockedCount: ReadonlySignal<number> = computed(() => this._state.value.unlocked.length);

  init(storage: TrophyStorage = localStorageTrophyStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Registra o resultado de uma partida; persiste se algo mudou. Retorna os ids recém-desbloqueados. */
  recordMatch(m: MatchSummary): readonly string[] {
    const { state, newlyUnlocked } = recordMatchState(this._state.value, m);
    this.commit(state); // stats sempre mudam (gamesPlayed++) ⇒ sempre persiste
    return newlyUnlocked;
  }

  private commit(state: TrophyState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const trophyService = new TrophyService();
export { TROPHY_CATALOG, trophyById } from './catalog';
export type { TrophyDef } from './catalog';
export type { MatchSummary } from './store';
export type { TrophyStorage } from './storage';
```

> Nota: `recordMatch` sempre incrementa `gamesPlayed`, então o estado sempre muda ⇒ `commit` incondicional é correto (diferente de `evaluate` isolado, que pode devolver o mesmo objeto).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/services/trophy/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/trophy/index.ts tests/services/trophy/index.test.ts
git commit -m "feat(4.7): TrophyService reativo (sinais unlockedIds/unlockedCount + recordMatch)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Fiação — game over, seam da Home, rota e chip

**Files:**
- Modify: `src/app/game/startGame.ts`
- Modify: `src/app/main.tsx`
- Modify: `src/app/home/stats.ts`
- Modify: `src/app/router/routes.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/screens/HomeScreen.tsx`
- Modify: `src/i18n/locales/*.json` (10 arquivos — chaves `nav.trophies`, `screen.trophies`)
- Test: `tests/app/home/stats.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `trophyService` de `@services/trophy`.
- Produces: rota `'trophies'`; `getHomeStats().trophies` reativo.

- [ ] **Step 1: Teste do seam da Home**

Verificar se existe `tests/app/home/stats.test.ts`. Se existir, adicionar o caso; senão criar:

```ts
import { describe, it, expect } from 'vitest';
import { getHomeStats } from '../../../src/app/home/stats';
import { trophyService } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';

describe('getHomeStats', () => {
  it('trophies reflete unlockedCount do trophyService', () => {
    walletService.init(memoryWalletStorage());
    trophyService.init(memoryTrophyStorage());
    expect(getHomeStats().trophies).toBe(0);
    trophyService.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 }); // firstFlight
    expect(getHomeStats().trophies).toBe(1);
  });
});
```

> Ajuste os caminhos de import ao padrão dos testes vizinhos (ver `tests/app/**`). Se já houver um `stats.test.ts`, apenas some este `it`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/home/stats.test.ts`
Expected: FAIL (`getHomeStats().trophies` ainda é `0` fixo ⇒ segundo expect falha).

- [ ] **Step 3: Religar `stats.ts`**

Editar `src/app/home/stats.ts`:

```ts
import { walletService } from '@services/wallet';
import { trophyService } from '@services/trophy';

/**
 * Stats agregados exibidos na barra de topo da Home.
 *
 * `coins` vem da carteira persistente (4.5). `trophies` vem do TrophyService (4.7).
 * `maxLevel` Endless ainda é placeholder — religa na Fase 5 (leaderboards).
 */
export interface HomeStats {
  readonly coins: number;
  readonly trophies: number;
  readonly maxLevel: number;
}

export function getHomeStats(): HomeStats {
  return {
    coins: walletService.balance.value,
    trophies: trophyService.unlockedCount.value,
    maxLevel: 1,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/app/home/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Adicionar a rota `trophies`**

Editar `src/app/router/routes.ts` — adicionar `| 'trophies'` ao union `Screen` (após `'expansions'`).

- [ ] **Step 6: Fiar o game over**

Editar `src/app/game/startGame.ts`:
- Adicionar import: `import { trophyService } from '@services/trophy';`
- Substituir o hook `onGameOver` por:

```ts
      onGameOver: (w) => {
        walletService.earn(coinsForFood(w.food));
        trophyService.recordMatch({
          distance: w.distance,
          food: w.food,
          nearMisses: w.nearMisses,
          score: w.score,
        });
      },
```

- [ ] **Step 7: `init` no bootstrap**

Editar `src/app/main.tsx`:
- Adicionar `import { trophyService } from '@services/trophy';`
- Após `entitlementsService.init();` adicionar `trophyService.init();`

- [ ] **Step 8: Chip 🏆 vira botão + case no App**

Editar `src/app/screens/HomeScreen.tsx` — a chip de troféus. Como `StatChip` é um `<div>`, envolver a chip de troféus num botão que navega. Trocar a linha:

```tsx
          <StatChip glyph="🏆" label={i18n.t('home.trophies')} value={stats.trophies} />
```

por:

```tsx
          <button
            type="button"
            class="home__statbtn"
            data-testid="home-trophies"
            onClick={() => navigate('trophies')}
          >
            <StatChip glyph="🏆" label={i18n.t('home.trophies')} value={stats.trophies} />
          </button>
```

Garantir que `navigate` está importado (já é usado por `home-identity`; confirmar o import de `../router`).

Editar `src/app/App.tsx`:
- Import: `import { TrophiesScreen } from './screens/TrophiesScreen';` (o arquivo chega na Task 5; para esta task passar o typecheck, ver nota abaixo).
- Adicionar o case antes do `default`:

```tsx
    case 'trophies':
      return <TrophiesScreen />;
```

> **Ordem de dependência:** o `case 'trophies'` referencia `TrophiesScreen` (Task 5). Para manter cada commit verde, **crie um stub mínimo** de `TrophiesScreen` nesta task e o preencha na Task 5:
> ```tsx
> // src/app/screens/TrophiesScreen.tsx (stub — completado na Task 5)
> import type { VNode } from 'preact';
> export function TrophiesScreen(): VNode {
>   return <div class="screen trophies" />;
> }
> ```
> Assim o `switch` exaustivo (`default: never`) compila e o commit da Task 4 fica verde.

- [ ] **Step 9: Chaves `nav.trophies` e `screen.trophies` nos 10 locales**

Em cada `src/i18n/locales/<lng>.json`, adicionar em `nav` a chave `trophies` e em `screen` a chave `trophies`. Traduções nativas:

| lng | nav.trophies / screen.trophies |
|-----|--------------------------------|
| en | `Trophies` |
| es | `Trofeos` |
| pt-BR | `Troféus` |
| fr | `Trophées` |
| it | `Trofei` |
| de | `Trophäen` |
| ja | `トロフィー` |
| zh | `奖杯` |
| ko | `트로피` |
| hi | `ट्रॉफ़ियाँ` |

(Ambas as chaves recebem o mesmo texto por locale.)

- [ ] **Step 10: Rodar check + testes afetados**

Run: `npm run check && npx vitest run tests/app tests/i18n/locales.test.ts`
Expected: typecheck limpo (switch exaustivo compila com o stub); paridade i18n verde.

- [ ] **Step 11: Commit**

```bash
git add src/app/game/startGame.ts src/app/main.tsx src/app/home/stats.ts \
        src/app/router/routes.ts src/app/App.tsx src/app/screens/HomeScreen.tsx \
        src/app/screens/TrophiesScreen.tsx src/i18n/locales tests/app/home/stats.test.ts
git commit -m "feat(4.7): fiação de troféus (game over, seam Home, rota trophies, chip 🏆)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `TrophiesScreen` + i18n do catálogo + CSS

**Files:**
- Modify: `src/app/screens/TrophiesScreen.tsx` (substitui o stub da Task 4)
- Modify: `src/app/styles/global.css`
- Modify: `src/i18n/locales/*.json` (chaves `trophy.<id>.{name,desc}` + `trophies.{title,locked,empty}`)
- Test: `tests/app/screens/TrophiesScreen.test.tsx`

**Interfaces:**
- Consumes: `trophyService`, `TROPHY_CATALOG` de `@services/trophy`; `i18n`; `back` de `../router`.

- [ ] **Step 1: Escrever o smoke de componente**

Criar `tests/app/screens/TrophiesScreen.test.tsx`. Espelhar o padrão de outro teste de tela em `tests/app/screens/` (imports de `@testing-library/preact` ou `render` manual + `happy-dom`; respeitar o gotcha signals+happy-dom — usar `await Promise.resolve()` após eventos). Esqueleto:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/preact';
import { TrophiesScreen } from '../../../src/app/screens/TrophiesScreen';
import { trophyService, TROPHY_CATALOG } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';
import { i18n } from '@services/i18n';

describe('TrophiesScreen', () => {
  beforeEach(async () => {
    await i18n.init();
    trophyService.init(memoryTrophyStorage());
  });

  it('renderiza um card por conquista do catálogo', () => {
    const { container } = render(<TrophiesScreen />);
    const cards = container.querySelectorAll('[data-testid^="trophy-card-"]');
    expect(cards.length).toBe(TROPHY_CATALOG.length);
  });

  it('marca desbloqueado vs bloqueado', () => {
    trophyService.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 }); // firstFlight
    const { container } = render(<TrophiesScreen />);
    expect(container.querySelector('[data-testid="trophy-card-firstFlight"]')?.getAttribute('data-unlocked')).toBe('true');
    expect(container.querySelector('[data-testid="trophy-card-centurion"]')?.getAttribute('data-unlocked')).toBe('false');
  });
});
```

> Confirme o util de render usado pelos testes de tela vizinhos (`tests/app/screens/*.test.tsx`) e alinhe imports. Se usarem `render` de `preact` + `happy-dom` direto, siga esse caminho.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/screens/TrophiesScreen.test.tsx`
Expected: FAIL (stub não tem cards).

- [ ] **Step 3: Implementar `TrophiesScreen.tsx`**

```tsx
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { trophyService, TROPHY_CATALOG, type TrophyDef } from '@services/trophy';

function TrophyCard({ def, unlocked }: { def: TrophyDef; unlocked: boolean }): VNode {
  return (
    <li
      class={`trophy-card${unlocked ? ' trophy-card--unlocked' : ''}`}
      data-testid={`trophy-card-${def.id}`}
      data-unlocked={unlocked ? 'true' : 'false'}
    >
      <span class="trophy-card__icon" aria-hidden="true">{unlocked ? '🏆' : '🔒'}</span>
      <div class="trophy-card__body">
        <h2 class="trophy-card__name">{i18n.t(def.nameKey)}</h2>
        <p class="trophy-card__desc">{i18n.t(def.descKey)}</p>
      </div>
      {!unlocked && (
        <span class="trophy-card__badge sr-only">{i18n.t('trophies.locked')}</span>
      )}
    </li>
  );
}

export function TrophiesScreen(): VNode {
  const unlocked = trophyService.unlockedIds.value;

  return (
    <div class="screen trophies">
      <h1 class="screen__title">{i18n.t('trophies.title')}</h1>

      {unlocked.length === 0 && <p class="trophies__empty">{i18n.t('trophies.empty')}</p>}

      <ul class="trophies__grid">
        {TROPHY_CATALOG.map((def) => (
          <TrophyCard key={def.id} def={def} unlocked={unlocked.includes(def.id)} />
        ))}
      </ul>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Chaves i18n do catálogo + tela (10 locales)**

Em cada `src/i18n/locales/<lng>.json`, adicionar dois blocos. `trophies` (tela) e `trophy` (catálogo). Textos `en` (traduzir nativamente para os outros 9, mantendo a mesma estrutura de chaves — paridade obrigatória):

```json
  "trophies": {
    "title": "Trophies",
    "locked": "Locked",
    "empty": "Play to earn your first trophy!"
  },
  "trophy": {
    "firstFlight": { "name": "First Flight", "desc": "Play your first game." },
    "centurion": { "name": "Centurion", "desc": "Reach 1000 distance in one run." },
    "forager": { "name": "Forager", "desc": "Collect 50 food in total." },
    "daredevil": { "name": "Daredevil", "desc": "Get 10 near-misses in one run." },
    "marathoner": { "name": "Marathoner", "desc": "Travel 10,000 total distance." },
    "highRoller": { "name": "High Roller", "desc": "Score 5000 in one run." },
    "persistent": { "name": "Persistent", "desc": "Play 25 games." }
  },
```

Traduções nativas por locale (nome + descrição) para es, pt-BR, fr, it, de, ja, zh, ko, hi. Ex. pt-BR:
```json
  "trophies": { "title": "Troféus", "locked": "Bloqueado", "empty": "Jogue para ganhar seu primeiro troféu!" },
  "trophy": {
    "firstFlight": { "name": "Primeiro Voo", "desc": "Jogue sua primeira partida." },
    "centurion": { "name": "Centurião", "desc": "Alcance 1000 de distância numa partida." },
    "forager": { "name": "Coletor", "desc": "Colete 50 de comida no total." },
    "daredevil": { "name": "Destemido", "desc": "Faça 10 quase-colisões numa partida." },
    "marathoner": { "name": "Maratonista", "desc": "Percorra 10.000 de distância total." },
    "highRoller": { "name": "Grande Apostador", "desc": "Faça 5000 de pontos numa partida." },
    "persistent": { "name": "Persistente", "desc": "Jogue 25 partidas." }
  },
```
(Produzir as demais 8 traduções no mesmo padrão. A skill `add-locale` pode guiar.)

- [ ] **Step 5: CSS**

Adicionar a `src/app/styles/global.css` (usar design tokens existentes; espelhar `.expansions`/`.expansion-card`):

```css
.trophies__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-sm);
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-md);
}
@media (min-width: 32rem) {
  .trophies__grid { grid-template-columns: 1fr 1fr; }
}
.trophy-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  opacity: 0.55;
}
.trophy-card--unlocked { opacity: 1; }
.trophy-card__icon { font-size: 1.75rem; line-height: 1; }
.trophy-card__body { min-width: 0; }
.trophy-card__name { margin: 0; font-size: var(--font-md); }
.trophy-card__desc { margin: 0; font-size: var(--font-sm); color: var(--color-text-muted); }
.trophies__empty { color: var(--color-text-muted); margin-bottom: var(--space-md); }
.home__statbtn { background: none; border: none; padding: 0; cursor: pointer; }
```

> Confirme os nomes exatos das custom properties em `src/app/styles/tokens.css` (ex.: `--space-sm`, `--radius-md`, `--color-surface`, `--color-text-muted`, `--font-md`). Se algum nome divergir, use o equivalente existente — **não** hardcode cores.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/app/screens/TrophiesScreen.test.tsx tests/i18n/locales.test.ts`
Expected: PASS (cards + paridade i18n verdes).

- [ ] **Step 7: Commit**

```bash
git add src/app/screens/TrophiesScreen.tsx src/app/styles/global.css src/i18n/locales tests/app/screens/TrophiesScreen.test.tsx
git commit -m "feat(4.7): tela de Troféus (grid locked/unlocked) + i18n do catálogo (10 locales)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run check` — typecheck + lint limpos.
- [ ] `npm test` — suíte inteira verde. Esperado: **determinismo 67 inalterado**; contagem de testes cresce (~+20).
- [ ] `npm run test:determinism` — confirmar 67 (core intocado).
- [ ] Marcar `4.7` como `[x]` em `docs/roadmap/PHASE-04-meta-offline.md`.
- [ ] Atualizar "Estado atual" em `CLAUDE.md` (4.7 concluído; próximo = 4.8 Configurações).
- [ ] Review final da branch (`superpowers:requesting-code-review` / agente `reviewer`).
- [ ] Merge no `main` (`--no-ff`; ou PR + merge automático se houver remote/`gh`).

## Self-Review (cobertura do spec)

- Modelo TrophyService (stats + unlocked + predicados) → Tasks 1–3. ✓
- Persistência robusta → Task 2. ✓
- Gatilho onGameOver + seam Home + rota + chip → Task 4. ✓
- TrophiesScreen + i18n 10 locales + CSS → Task 5. ✓
- Catálogo de 7 (cumulativo + best) → Task 1 catalog. ✓
- Determinismo intocado → nenhuma task toca `src/core/`. ✓
- `newlyUnlocked` devolvido (seam de toast futuro) → Task 3 `recordMatch` retorna. ✓
- `maxLevel` segue placeholder → Task 4 stats.ts mantém `maxLevel: 1`. ✓
