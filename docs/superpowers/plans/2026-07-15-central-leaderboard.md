# Leaderboard Central (6.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Submeter e ler rankings globais Endless/Diário/Semanal via Supabase, com fallback local offline-first.

**Architecture:** Estende o seam `OnlineClient` (mesma sessão anônima) com `submitScore`/`fetchScores`; `OnlineService` expõe sinal `online` + delegadores guardados; `LeaderboardService` fica online-aware via interface injetável `LeaderboardOnline` (memória nos testes, adapter real no `app/`), com mapeamento puro `toCentralEntries`. Tela alterna fonte Global/Local pelo status.

**Tech Stack:** TypeScript estrito, `@supabase/supabase-js`, `@preact/signals`, Preact, Vitest.

## Global Constraints

- `src/core/` **NÃO é tocado** ⇒ determinismo 67 inalterado.
- Sem string visível hardcoded: tudo via `i18n.t` (REGRA 4), 10 locales, paridade + scanner AST verdes.
- Offline-first: sem `.env`/offline ⇒ comportamento idêntico ao atual; nenhuma exceção propagada (best-effort).
- Infra (`online/`) não importa a feature (`leaderboard/`); tipos de score usam `ONLINE_MODES` de `online/schema.ts`.
- `MAX_ENTRIES = 10` (reusar de `leaderboard/store`).
- Commits pequenos, um por task, mensagem `feat(6.3): …` com trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Seam de IO — `submitScore`/`fetchScores` no `OnlineClient`

**Files:**
- Modify: `src/services/online/client.ts`
- Test: `tests/services/online/client.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `ONLINE_MODES` de `./schema`.
- Produces: tipos `OnlineMode`, `OnlineScoreInput`, `OnlineScoreRow`; métodos `OnlineClient.submitScore(input)` / `OnlineClient.fetchScores(mode, seed?)`; `memoryOnlineClient(opts)` com `opts.scores?: OnlineScoreRow[]` e campo `submittedScores: OnlineScoreInput[]`.

- [ ] **Step 1: Write the failing test** — `tests/services/online/client.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { memoryOnlineClient, type OnlineScoreRow } from '@services/online/client';

const row = (o: Partial<OnlineScoreRow> & { playerId: string; score: number; mode: 'endless' | 'daily' | 'weekly'; seed: string }): OnlineScoreRow => ({
  playerName: 'P', playerAvatar: '0', distance: 0, food: 0, nearMisses: 0, level: 0, createdAt: 0, ...o,
});

describe('memoryOnlineClient scores', () => {
  it('grava submits', async () => {
    const c = memoryOnlineClient();
    await c.submitScore({ playerId: 'u1', mode: 'endless', seed: 'endless:A', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2 });
    expect(c.submittedScores).toHaveLength(1);
    expect(c.submittedScores[0]?.score).toBe(10);
  });

  it('fetchScores filtra por mode e seed', async () => {
    const c = memoryOnlineClient({
      scores: [
        row({ playerId: 'a', mode: 'endless', seed: 'endless:A', score: 9 }),
        row({ playerId: 'b', mode: 'daily', seed: 'daily:2026-07-15', score: 7 }),
        row({ playerId: 'c', mode: 'daily', seed: 'daily:2026-07-14', score: 5 }),
      ],
    });
    expect(await c.fetchScores('endless')).toHaveLength(1);
    expect(await c.fetchScores('daily', 'daily:2026-07-15')).toHaveLength(1);
    expect((await c.fetchScores('daily', 'daily:2026-07-15'))[0]?.playerId).toBe('b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/online/client.test.ts`
Expected: FAIL (`submitScore`/`fetchScores`/`submittedScores` inexistentes).

- [ ] **Step 3: Implement** — editar `src/services/online/client.ts`

Adicionar import e tipos no topo (após imports existentes):

```ts
import { SUPABASE_SCHEMA, TABLES, ONLINE_MODES } from './schema';

export type OnlineMode = (typeof ONLINE_MODES)[number];

export interface OnlineScoreInput {
  readonly playerId: string;
  readonly mode: OnlineMode;
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly level: number;
}

export interface OnlineScoreRow extends OnlineScoreInput {
  readonly playerName: string;
  readonly playerAvatar: string;
  readonly createdAt: number;
}
```

Estender a interface `OnlineClient` com:

```ts
  submitScore(input: OnlineScoreInput): Promise<void>;
  fetchScores(mode: OnlineMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
```

Estender `MemoryOnlineClient`:

```ts
export interface MemoryOnlineClient extends OnlineClient {
  readonly upserts: OnlinePlayer[];
  readonly signInCount: number;
  readonly submittedScores: OnlineScoreInput[];
}
```

Em `memoryOnlineClient(opts)`, aceitar `scores?: OnlineScoreRow[]`, criar `const submittedScores: OnlineScoreInput[] = [];`, adicionar ao retorno `submittedScores` e os métodos:

```ts
    async submitScore(input) {
      submittedScores.push(input);
    },
    async fetchScores(mode, seed) {
      const all = opts.scores ?? [];
      return all.filter((r) => r.mode === mode && (seed === undefined || r.seed === seed));
    },
```

(atualizar a assinatura de `opts` para `{ uid?: string; failSignIn?: boolean; scores?: OnlineScoreRow[] }`).

Em `createSupabaseClient`, adicionar ao objeto retornado:

```ts
    async submitScore(input) {
      const { error } = await supabase.from(TABLES.scores).insert({
        player_id: input.playerId, mode: input.mode, seed: input.seed,
        score: input.score, distance: input.distance, food: input.food,
        near_misses: input.nearMisses, level: input.level,
      });
      if (error !== null) throw error;
    },
    async fetchScores(mode, seed) {
      let query = supabase
        .from(TABLES.scores)
        .select('player_id, mode, seed, score, distance, food, near_misses, level, created_at, players(name, avatar)')
        .eq('mode', mode)
        .order('score', { ascending: false })
        .limit(MAX_ONLINE_ROWS);
      if (seed !== undefined) query = query.eq('seed', seed);
      const { data, error } = await query;
      if (error !== null) throw error;
      return (data ?? []).map(mapScoreRow);
    },
```

Adicionar no fim do arquivo o mapeador e a constante (fora das funções):

```ts
const MAX_ONLINE_ROWS = 80; // MAX_ENTRIES × 8 — folga p/ dedup por jogador no cliente

interface RawScoreRow {
  player_id: string; mode: string; seed: string; score: number;
  distance: number; food: number; near_misses: number; level: number;
  created_at: string;
  players: { name: string; avatar: string | null } | { name: string; avatar: string | null }[] | null;
}

function mapScoreRow(raw: RawScoreRow): OnlineScoreRow {
  const p = Array.isArray(raw.players) ? raw.players[0] : raw.players;
  return {
    playerId: raw.player_id,
    mode: raw.mode as OnlineMode,
    seed: raw.seed,
    score: raw.score, distance: raw.distance, food: raw.food,
    nearMisses: raw.near_misses, level: raw.level,
    playerName: p?.name ?? '',
    playerAvatar: p?.avatar ?? '',
    createdAt: Date.parse(raw.created_at) || 0,
  };
}
```

Nota: o `.select(...)` do supabase-js retorna tipo largo; se o `tsc` reclamar do `.map(mapScoreRow)`, castar `(data ?? []) as unknown as RawScoreRow[]` antes do `.map` (casca não testada, cast justificado por comentário).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/online/client.test.ts && npm run check`
Expected: PASS + typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/services/online/client.ts tests/services/online/client.test.ts
git commit -m "feat(6.3): submitScore/fetchScores no seam OnlineClient (+memory spy)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Mapeamento puro `toCentralEntries`

**Files:**
- Create: `src/services/leaderboard/central.ts`
- Test: `tests/services/leaderboard/central.test.ts`

**Interfaces:**
- Consumes: `OnlineScoreRow` de `@services/online/client`; `MAX_ENTRIES`, `sanitizeStat` de `./store`.
- Produces: tipo `CentralEntry`; `toCentralEntries(rows, maxEntries?): readonly CentralEntry[]`.

- [ ] **Step 1: Write the failing test** — `tests/services/leaderboard/central.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { toCentralEntries } from '@services/leaderboard/central';
import type { OnlineScoreRow } from '@services/online/client';

const row = (playerId: string, score: number, extra: Partial<OnlineScoreRow> = {}): OnlineScoreRow => ({
  playerId, playerName: playerId.toUpperCase(), playerAvatar: '0',
  mode: 'endless', seed: `s-${playerId}-${score}`, score,
  distance: score, food: 0, nearMisses: 0, level: 0, createdAt: 0, ...extra,
});

describe('toCentralEntries', () => {
  it('ordena por score desc', () => {
    const out = toCentralEntries([row('a', 5), row('b', 9), row('c', 7)]);
    expect(out.map((e) => e.playerId)).toEqual(['b', 'c', 'a']);
  });

  it('dedup por jogador mantendo o melhor score', () => {
    const out = toCentralEntries([row('a', 5), row('a', 12), row('b', 9)]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ playerId: 'a', score: 12 });
  });

  it('corta em maxEntries', () => {
    const rows = Array.from({ length: 15 }, (_, i) => row(`p${i}`, i));
    expect(toCentralEntries(rows, 10)).toHaveLength(10);
  });

  it('saneia números negativos/NaN para 0', () => {
    const out = toCentralEntries([row('a', Number.NaN, { distance: -3 })]);
    expect(out[0]).toMatchObject({ score: 0, distance: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/leaderboard/central.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement** — `src/services/leaderboard/central.ts`

```ts
import type { OnlineScoreRow } from '@services/online/client';
import { MAX_ENTRIES, sanitizeStat } from './store';

export interface CentralEntry {
  readonly playerId: string;
  readonly playerName: string;
  readonly playerAvatar: string;
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly createdAt: number;
}

function entryOf(r: OnlineScoreRow): CentralEntry {
  return {
    playerId: r.playerId,
    playerName: r.playerName,
    playerAvatar: r.playerAvatar,
    seed: r.seed,
    score: sanitizeStat(r.score),
    distance: sanitizeStat(r.distance),
    food: sanitizeStat(r.food),
    nearMisses: sanitizeStat(r.nearMisses),
    createdAt: Number.isFinite(r.createdAt) ? r.createdAt : 0,
  };
}

/** Dedup por jogador (melhor score), ordena por score desc, corta top-N. Puro. */
export function toCentralEntries(
  rows: readonly OnlineScoreRow[],
  maxEntries: number = MAX_ENTRIES,
): readonly CentralEntry[] {
  const best = new Map<string, CentralEntry>();
  for (const raw of rows) {
    const e = entryOf(raw);
    const prev = best.get(e.playerId);
    if (prev === undefined || e.score > prev.score) best.set(e.playerId, e);
  }
  return [...best.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
    })
    .slice(0, maxEntries);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/leaderboard/central.test.ts && npm run check`
Expected: PASS + typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/services/leaderboard/central.ts tests/services/leaderboard/central.test.ts
git commit -m "feat(6.3): toCentralEntries puro (dedup por jogador, ordena, top-N)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Interface `LeaderboardOnline` + memória de teste

**Files:**
- Create: `src/services/leaderboard/online.ts`
- Test: `tests/services/leaderboard/online-memory.test.ts`

**Interfaces:**
- Consumes: `LeaderboardMode`, `LeaderboardResult` de `./store`; `OnlineScoreRow` de `@services/online/client`; `signal`, `ReadonlySignal` de `@preact/signals`.
- Produces: interface `LeaderboardOnline`; `memoryLeaderboardOnline(opts)` retornando `LeaderboardOnline` + `{ submitted: LeaderboardResult[]; setOnline(v): void }`.

- [ ] **Step 1: Write the failing test** — `tests/services/leaderboard/online-memory.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';

describe('memoryLeaderboardOnline', () => {
  it('online configurável e grava submits', async () => {
    const m = memoryLeaderboardOnline({ online: true });
    expect(m.online.value).toBe(true);
    await m.submitScore({ mode: 'endless', seed: 's', score: 1, distance: 1, food: 0, nearMisses: 0, level: 0, achievedAt: 0 });
    expect(m.submitted).toHaveLength(1);
  });

  it('setOnline alterna o sinal', () => {
    const m = memoryLeaderboardOnline({ online: false });
    m.setOnline(true);
    expect(m.online.value).toBe(true);
  });

  it('fetchScores devolve rows por modo', async () => {
    const m = memoryLeaderboardOnline({
      online: true,
      rows: { endless: [{ playerId: 'a', playerName: 'A', playerAvatar: '0', mode: 'endless', seed: 's', score: 3, distance: 0, food: 0, nearMisses: 0, level: 0, createdAt: 0 }] },
    });
    expect(await m.fetchScores('endless')).toHaveLength(1);
    expect(await m.fetchScores('daily')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/leaderboard/online-memory.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement** — `src/services/leaderboard/online.ts`

```ts
import { signal, type ReadonlySignal } from '@preact/signals';
import type { LeaderboardMode, LeaderboardResult } from './store';
import type { OnlineScoreRow } from '@services/online/client';

export interface LeaderboardOnline {
  readonly online: ReadonlySignal<boolean>;
  submitScore(input: LeaderboardResult): Promise<void>;
  fetchScores(mode: LeaderboardMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
  currentSeeds(): { readonly daily: string; readonly weekly: string };
}

export interface MemoryLeaderboardOnline extends LeaderboardOnline {
  readonly submitted: LeaderboardResult[];
  setOnline(v: boolean): void;
}

export function memoryLeaderboardOnline(opts: {
  online?: boolean;
  rows?: Partial<Record<LeaderboardMode, readonly OnlineScoreRow[]>>;
  seeds?: { daily: string; weekly: string };
} = {}): MemoryLeaderboardOnline {
  const _online = signal(opts.online ?? false);
  const submitted: LeaderboardResult[] = [];
  return {
    online: _online,
    submitted,
    setOnline(v) {
      _online.value = v;
    },
    async submitScore(input) {
      submitted.push(input);
    },
    async fetchScores(mode) {
      return opts.rows?.[mode] ?? [];
    },
    currentSeeds() {
      return opts.seeds ?? { daily: 'daily:x', weekly: 'weekly:x' };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/leaderboard/online-memory.test.ts && npm run check`
Expected: PASS + typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/services/leaderboard/online.ts tests/services/leaderboard/online-memory.test.ts
git commit -m "feat(6.3): interface LeaderboardOnline + memory p/ testes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `OnlineService` — sinal `online` + delegadores guardados

**Files:**
- Modify: `src/services/online/index.ts`
- Test: `tests/services/online/scores-delegation.test.ts`

**Interfaces:**
- Consumes: `memoryOnlineClient` de `./client`; `OnlineScoreInput`, `OnlineScoreRow`, `OnlineMode` de `./client`.
- Produces: `onlineService.online: ReadonlySignal<boolean>`; `onlineService.submitScore(input: Omit<OnlineScoreInput,'playerId'>): Promise<void>`; `onlineService.fetchScores(mode, seed?): Promise<readonly OnlineScoreRow[]>`.

- [ ] **Step 1: Write the failing test** — `tests/services/online/scores-delegation.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { OnlineService } from '@services/online';
import { memoryOnlineClient } from '@services/online/client';

// perfil mínimo p/ init
const profileStub = { activeProfile: { value: null } } as never;

describe('OnlineService scores', () => {
  it('offline ⇒ submitScore no-op e fetchScores vazio', async () => {
    const svc = new OnlineService();
    await svc.init({ config: null, client: null, profile: profileStub });
    expect(svc.online.value).toBe(false);
    await svc.submitScore({ mode: 'endless', seed: 's', score: 1, distance: 1, food: 0, nearMisses: 0, level: 0 });
    expect(await svc.fetchScores('endless')).toHaveLength(0);
  });

  it('online ⇒ submitScore anexa playerId e delega ao client', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1' });
    const svc = new OnlineService();
    await svc.init({ config: { url: 'u', anonKey: 'k' }, client, profile: profileStub });
    expect(svc.online.value).toBe(true);
    await svc.submitScore({ mode: 'endless', seed: 's', score: 5, distance: 2, food: 0, nearMisses: 0, level: 1 });
    expect(client.submittedScores[0]).toMatchObject({ playerId: 'uid-1', score: 5 });
  });
});
```

Nota: `OnlineService` hoje não é exportado como classe. No Step 3, exportar a classe (`export class OnlineService`) mantendo o singleton `export const onlineService`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/online/scores-delegation.test.ts`
Expected: FAIL (`online`/`submitScore`/`fetchScores` inexistentes; classe não exportada).

- [ ] **Step 3: Implement** — editar `src/services/online/index.ts`

- Trocar `class OnlineService` por `export class OnlineService`.
- Importar tipos: `import { createSupabaseClient, type OnlineClient, type OnlinePlayer, type OnlineScoreInput, type OnlineScoreRow, type OnlineMode } from './client';`
- Adicionar sinal computed e delegadores dentro da classe:

```ts
  readonly online: ReadonlySignal<boolean> = computed(() => this._status.value === 'online');

  async submitScore(input: Omit<OnlineScoreInput, 'playerId'>): Promise<void> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return;
    try {
      await this.client.submitScore({ ...input, playerId: id });
    } catch {
      // best-effort: falha de rede não derruba o status
    }
  }

  async fetchScores(mode: OnlineMode, seed?: string): Promise<readonly OnlineScoreRow[]> {
    if (this._status.value !== 'online' || this.client === null) return [];
    try {
      return await this.client.fetchScores(mode, seed);
    } catch {
      return [];
    }
  }
```

- Reexportar tipos no fim: `export type { OnlineScoreInput, OnlineScoreRow, OnlineMode } from './client';`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/online/scores-delegation.test.ts && npm run check`
Expected: PASS + typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/services/online/index.ts tests/services/online/scores-delegation.test.ts
git commit -m "feat(6.3): OnlineService expõe sinal online + submitScore/fetchScores guardados

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `LeaderboardService` online-aware

**Files:**
- Modify: `src/services/leaderboard/index.ts`
- Test: `tests/services/leaderboard/service-online.test.ts`

**Interfaces:**
- Consumes: `LeaderboardOnline`, `memoryLeaderboardOnline` de `./online`; `toCentralEntries`, `CentralEntry` de `./central`; `effect` de `@preact/signals`.
- Produces: `LeaderboardService.init(storage?, online?: LeaderboardOnline)`; sinais `centralEndless/centralDaily/centralWeekly: ReadonlySignal<readonly CentralEntry[]>`; `centralAvailable: ReadonlySignal<boolean>`.

- [ ] **Step 1: Write the failing test** — `tests/services/leaderboard/service-online.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';
import type { OnlineScoreRow } from '@services/online/client';

const flush = () => new Promise((r) => setTimeout(r, 0));
const erow = (playerId: string, score: number): OnlineScoreRow => ({
  playerId, playerName: playerId, playerAvatar: '0', mode: 'endless',
  seed: `s-${playerId}`, score, distance: 0, food: 0, nearMisses: 0, level: 0, createdAt: 0,
});

describe('LeaderboardService online-aware', () => {
  it('sem adapter ⇒ central vazio, comportamento local intacto', () => {
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage());
    svc.recordMatch({ mode: 'endless', seed: 's', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2, achievedAt: 1 });
    expect(svc.endless.value).toHaveLength(1);
    expect(svc.centralEndless.value).toHaveLength(0);
    expect(svc.centralAvailable.value).toBe(false);
  });

  it('online já ativo ⇒ init faz refreshCentral', async () => {
    const online = memoryLeaderboardOnline({ online: true, rows: { endless: [erow('a', 9), erow('b', 4)] } });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    expect(svc.centralAvailable.value).toBe(true);
    expect(svc.centralEndless.value.map((e) => e.playerId)).toEqual(['a', 'b']);
  });

  it('online-flip dispara refreshCentral', async () => {
    const online = memoryLeaderboardOnline({ online: false, rows: { endless: [erow('a', 3)] } });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    expect(svc.centralEndless.value).toHaveLength(0);
    online.setOnline(true);
    await flush();
    expect(svc.centralEndless.value).toHaveLength(1);
  });

  it('recordMatch online submete o resultado', async () => {
    const online = memoryLeaderboardOnline({ online: true });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    svc.recordMatch({ mode: 'endless', seed: 's', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2, achievedAt: 1 });
    await flush();
    expect(online.submitted).toHaveLength(1);
    expect(online.submitted[0]?.score).toBe(10);
  });

  it('offline ⇒ recordMatch não submete', async () => {
    const online = memoryLeaderboardOnline({ online: false });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    await flush();
    svc.recordMatch({ mode: 'endless', seed: 's', score: 10, distance: 5, food: 1, nearMisses: 0, level: 2, achievedAt: 1 });
    await flush();
    expect(online.submitted).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/leaderboard/service-online.test.ts`
Expected: FAIL (`LeaderboardService` não exportado como classe / sinais central inexistentes).

- [ ] **Step 3: Implement** — editar `src/services/leaderboard/index.ts`

Substituir o conteúdo por (mantém a API local existente, adiciona online):

```ts
import { signal, computed, effect, type ReadonlySignal } from '@preact/signals';
import {
  initialLeaderboardState,
  recordMatch as recordMatchState,
  rankOf,
  type LeaderboardEntry,
  type LeaderboardMode,
  type LeaderboardResult,
  type LeaderboardState,
} from './store';
import {
  localStorageLeaderboardStorage,
  memoryLeaderboardStorage,
  type LeaderboardStorage,
} from './storage';
import { toCentralEntries, type CentralEntry } from './central';
import type { LeaderboardOnline } from './online';

const EMPTY_CENTRAL: readonly CentralEntry[] = [];

export class LeaderboardService {
  private storage: LeaderboardStorage = memoryLeaderboardStorage();
  private readonly _state = signal<LeaderboardState>(initialLeaderboardState());
  private readonly _central = signal<Record<LeaderboardMode, readonly CentralEntry[]>>({
    endless: EMPTY_CENTRAL, daily: EMPTY_CENTRAL, weekly: EMPTY_CENTRAL,
  });
  private online: LeaderboardOnline | null = null;
  private disposeEffect: (() => void) | null = null;
  private lastOnline = false;

  readonly endless: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.endless);
  readonly daily: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.daily);
  readonly weekly: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.weekly);
  readonly bestEndlessLevel: ReadonlySignal<number> = computed(() => this._state.value.bestEndlessLevel);

  readonly centralEndless: ReadonlySignal<readonly CentralEntry[]> = computed(() => this._central.value.endless);
  readonly centralDaily: ReadonlySignal<readonly CentralEntry[]> = computed(() => this._central.value.daily);
  readonly centralWeekly: ReadonlySignal<readonly CentralEntry[]> = computed(() => this._central.value.weekly);
  readonly centralAvailable: ReadonlySignal<boolean> = computed(() => this.online?.online.value ?? false);

  init(storage: LeaderboardStorage = localStorageLeaderboardStorage(), online?: LeaderboardOnline): void {
    this.storage = storage;
    this._state.value = storage.load();

    if (this.disposeEffect !== null) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.online = online ?? null;
    this.lastOnline = false;
    this._central.value = { endless: EMPTY_CENTRAL, daily: EMPTY_CENTRAL, weekly: EMPTY_CENTRAL };

    if (this.online !== null) {
      const o = this.online;
      this.disposeEffect = effect(() => {
        const isOnline = o.online.value; // assina o sinal
        if (isOnline && !this.lastOnline) {
          this.lastOnline = true;
          void this.refreshCentral();
        } else if (!isOnline) {
          this.lastOnline = false;
        }
      });
    }
  }

  recordMatch(r: LeaderboardResult): void {
    const next = recordMatchState(this._state.value, r);
    if (next !== this._state.value) {
      this._state.value = next;
      this.storage.save(next);
    }
    const o = this.online;
    if (o !== null && o.online.value) {
      void o.submitScore(r).then(() => this.refreshMode(r.mode));
    }
  }

  dailyRankForSeed(seed: string): number | undefined {
    return rankOf(this._state.value.daily, seed);
  }

  private async refreshCentral(): Promise<void> {
    await Promise.all([
      this.refreshMode('endless'),
      this.refreshMode('daily'),
      this.refreshMode('weekly'),
    ]);
  }

  private async refreshMode(mode: LeaderboardMode): Promise<void> {
    const o = this.online;
    if (o === null || !o.online.value) return;
    const seed =
      mode === 'daily' ? o.currentSeeds().daily
      : mode === 'weekly' ? o.currentSeeds().weekly
      : undefined;
    const rows = await o.fetchScores(mode, seed);
    this._central.value = { ...this._central.value, [mode]: toCentralEntries(rows) };
  }
}

export const leaderboardService = new LeaderboardService();
export type { LeaderboardEntry, LeaderboardMode, LeaderboardResult } from './store';
export type { LeaderboardStorage } from './storage';
export type { CentralEntry } from './central';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/leaderboard/ && npm run check`
Expected: PASS + typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/services/leaderboard/index.ts tests/services/leaderboard/service-online.test.ts
git commit -m "feat(6.3): LeaderboardService online-aware (central signals + submit + refresh)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Adapter real, fiação e tela (Global/Local) + i18n

**Files:**
- Create: `src/app/online/leaderboardAdapter.ts`
- Modify: `src/app/main.tsx`
- Modify: `src/app/screens/LeaderboardScreen.tsx`
- Modify: `src/services/i18n/locales/*.json` (10 arquivos) — via skill `add-locale`
- Test: `tests/services/leaderboard/adapter.test.ts`

**Interfaces:**
- Consumes: `onlineService` (`online`, `submitScore`, `fetchScores`) de `@services/online`; `dailyChallengeSeed`, `weeklyChallengeSeed` de `@render/seedSource`; `leaderboardService`, `CentralEntry` de `@services/leaderboard`.
- Produces: `createLeaderboardOnline(): LeaderboardOnline`.

- [ ] **Step 1: Write the failing test** — `tests/services/leaderboard/adapter.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createLeaderboardOnline } from '../../../src/app/online/leaderboardAdapter';

describe('createLeaderboardOnline', () => {
  it('mapeia LeaderboardResult → submitScore do onlineService (sem playerId)', async () => {
    const calls: unknown[] = [];
    const fakeOnline = {
      online: { value: true },
      submitScore: async (i: unknown) => { calls.push(i); },
      fetchScores: async () => [],
    } as never;
    const adapter = createLeaderboardOnline({
      onlineSvc: fakeOnline,
      dailySeed: () => 'daily:D', weeklySeed: () => 'weekly:W',
    });
    await adapter.submitScore({ mode: 'endless', seed: 's', score: 7, distance: 3, food: 1, nearMisses: 0, level: 2, achievedAt: 0 });
    expect(calls[0]).toMatchObject({ mode: 'endless', seed: 's', score: 7, nearMisses: 0 });
    expect(adapter.currentSeeds()).toEqual({ daily: 'daily:D', weekly: 'weekly:W' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/leaderboard/adapter.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3a: Implement adapter** — `src/app/online/leaderboardAdapter.ts`

```ts
import { onlineService } from '@services/online';
import { dailyChallengeSeed, weeklyChallengeSeed } from '@render/seedSource';
import type { LeaderboardOnline } from '@services/leaderboard/online';
import type { LeaderboardMode, LeaderboardResult } from '@services/leaderboard';
import type { OnlineScoreRow } from '@services/online/client';

interface OnlineScoresLike {
  readonly online: { readonly value: boolean };
  submitScore(input: {
    mode: LeaderboardMode; seed: string; score: number; distance: number;
    food: number; nearMisses: number; level: number;
  }): Promise<void>;
  fetchScores(mode: LeaderboardMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
}

export function createLeaderboardOnline(deps: {
  onlineSvc?: OnlineScoresLike;
  dailySeed?: () => string;
  weeklySeed?: () => string;
} = {}): LeaderboardOnline {
  const svc = (deps.onlineSvc ?? onlineService) as OnlineScoresLike;
  const dailySeed = deps.dailySeed ?? dailyChallengeSeed;
  const weeklySeed = deps.weeklySeed ?? weeklyChallengeSeed;
  return {
    online: svc.online as LeaderboardOnline['online'],
    async submitScore(r: LeaderboardResult) {
      await svc.submitScore({
        mode: r.mode, seed: r.seed, score: r.score, distance: r.distance,
        food: r.food, nearMisses: r.nearMisses, level: r.level,
      });
    },
    fetchScores(mode, seed) {
      return svc.fetchScores(mode, seed);
    },
    currentSeeds() {
      return { daily: dailySeed(), weekly: weeklySeed() };
    },
  };
}
```

- [ ] **Step 3b: Wire main.tsx** — editar `src/app/main.tsx`

Adicionar import `import { createLeaderboardOnline } from './online/leaderboardAdapter';` e trocar a linha `leaderboardService.init();` por:

```ts
  leaderboardService.init(undefined, createLeaderboardOnline());
```

- [ ] **Step 3c: i18n** — via skill `add-locale`, adicionar as chaves nos 10 locales:
`leaderboard.source.global` (ex.: "Global"), `leaderboard.source.local` (ex.: "Local"),
`leaderboard.player` (rótulo do nome, ex.: "Player"). Manter paridade + traduções nativas.

- [ ] **Step 3d: Screen** — editar `src/app/screens/LeaderboardScreen.tsx`

Ler os sinais centrais e alternar a fonte. Substituir `entriesFor`/render por:

```tsx
import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { onlineService } from '@services/online';
import {
  leaderboardService, type LeaderboardEntry, type LeaderboardMode, type CentralEntry,
} from '@services/leaderboard';

const TABS: readonly LeaderboardMode[] = ['endless', 'daily', 'weekly'];
const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };
const rankGlyph = (i: number): string => MEDALS[i] ?? `${i + 1}`;

function LocalRow({ entry, index }: { entry: LeaderboardEntry; index: number }): VNode {
  return (
    <li class="leaderboard__row" data-testid={`leaderboard-row-${index}`}>
      <span class="leaderboard__rank" aria-hidden={index < 3 ? 'true' : undefined}>{rankGlyph(index)}</span>
      <span class="leaderboard__score" aria-label={i18n.t('leaderboard.score')}>{entry.score}</span>
      <span class="leaderboard__detail">
        {i18n.t('leaderboard.distance')}: {entry.distance} · {i18n.t('leaderboard.food')}: {entry.food} · {i18n.t('leaderboard.nearMisses')}: {entry.nearMisses}
      </span>
      <span class="leaderboard__seed">{entry.seed}</span>
    </li>
  );
}

function CentralRow({ entry, index, me }: { entry: CentralEntry; index: number; me: string | null }): VNode {
  const isMe = me !== null && entry.playerId === me;
  return (
    <li class={`leaderboard__row${isMe ? ' leaderboard__row--me' : ''}`} data-testid={`leaderboard-row-${index}`}>
      <span class="leaderboard__rank" aria-hidden={index < 3 ? 'true' : undefined}>{rankGlyph(index)}</span>
      <span class="leaderboard__score" aria-label={i18n.t('leaderboard.score')}>{entry.score}</span>
      <span class="leaderboard__player" aria-label={i18n.t('leaderboard.player')}>{entry.playerName}</span>
      <span class="leaderboard__detail">
        {i18n.t('leaderboard.distance')}: {entry.distance} · {i18n.t('leaderboard.food')}: {entry.food} · {i18n.t('leaderboard.nearMisses')}: {entry.nearMisses}
      </span>
    </li>
  );
}

function centralFor(mode: LeaderboardMode): readonly CentralEntry[] {
  if (mode === 'endless') return leaderboardService.centralEndless.value;
  if (mode === 'daily') return leaderboardService.centralDaily.value;
  return leaderboardService.centralWeekly.value;
}
function localFor(mode: LeaderboardMode): readonly LeaderboardEntry[] {
  if (mode === 'endless') return leaderboardService.endless.value;
  if (mode === 'daily') return leaderboardService.daily.value;
  return leaderboardService.weekly.value;
}

export function LeaderboardScreen(): VNode {
  const [tab, setTab] = useState<LeaderboardMode>('endless');
  const isOnline = leaderboardService.centralAvailable.value;
  const central = centralFor(tab);
  const local = localFor(tab);
  const me = onlineService.globalPlayerId.value;
  const useCentral = isOnline;
  const empty = useCentral ? central.length === 0 : local.length === 0;

  return (
    <div class="screen leaderboard">
      <h1 class="screen__title">{i18n.t('leaderboard.title')}</h1>
      <p class="leaderboard__source" data-testid="leaderboard-source">
        {i18n.t(useCentral ? 'leaderboard.source.global' : 'leaderboard.source.local')}
      </p>

      <div class="leaderboard__tabs" role="tablist">
        {TABS.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={tab === m ? 'true' : 'false'}
            class={`leaderboard__tab${tab === m ? ' leaderboard__tab--active' : ''}`}
            data-testid={`leaderboard-tab-${m}`} onClick={() => setTab(m)}>
            {i18n.t(`leaderboard.tab.${m}`)}
          </button>
        ))}
      </div>

      {empty ? (
        <p class="leaderboard__empty">{i18n.t('leaderboard.empty')}</p>
      ) : (
        <ol class="leaderboard__list">
          {useCentral
            ? central.map((e, i) => <CentralRow key={`${e.playerId}-${e.seed}`} entry={e} index={i} me={me} />)
            : local.map((e, i) => <LocalRow key={`${e.seed}-${e.achievedAt}`} entry={e} index={i} />)}
        </ol>
      )}

      <button type="button" class="btn btn--ghost" onClick={() => back()}>{i18n.t('nav.back')}</button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + full suite**

Run: `npx vitest run tests/services/leaderboard/adapter.test.ts && npm test && npm run check`
Expected: PASS (incluindo i18n paridade + scanner AST + determinismo 67).

- [ ] **Step 5: Commit**

```bash
git add src/app/online/leaderboardAdapter.ts src/app/main.tsx src/app/screens/LeaderboardScreen.tsx src/services/i18n/locales tests/services/leaderboard/adapter.test.ts
git commit -m "feat(6.3): adapter online + fiação + tela Global/Local + i18n 10 locales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** seam IO (T1) ✓, mapeamento puro (T2) ✓, interface injetável+memória (T3) ✓, OnlineService sinal+delegadores (T4) ✓, LeaderboardService central+submit+refresh (T5) ✓, adapter+fiação+tela+i18n (T6) ✓. Offline-first testado em T4/T5. `verified` não exibido (fora de escopo, ok). Destaque "você" incluído (T6, barato via `globalPlayerId`).

**Placeholders:** nenhum — todo passo tem código real.

**Type consistency:** `OnlineScoreRow`/`OnlineScoreInput`/`OnlineMode` definidos em T1, consumidos em T2/T3/T4/T6; `LeaderboardOnline`/`memoryLeaderboardOnline` em T3, usados em T5; sinais `central*`/`centralAvailable` em T5, lidos em T6; `createLeaderboardOnline` em T6. `LeaderboardResult` já existe em store. `MAX_ENTRIES`/`sanitizeStat` reusados de store.

**Nota de layering:** `leaderboard/` importa **tipo** `OnlineScoreRow` de `online/client` (feature→infra, aceitável); `online/` não importa `leaderboard/`.
