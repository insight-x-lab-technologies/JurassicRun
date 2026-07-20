# Troféus centrais (sincronizados) + pódio diário global — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar troféus locais ao perfil online (tabela `jurassicrun.trophies`) e endurecer o troféu `dailyPodium` para o top-3 do leaderboard **central** quando online, mantendo fallback local offline.

**Architecture:** Molde do leaderboard online (6.3): seam de IO no `OnlineClient`/`OnlineService`, interface injetável `TrophyOnline` + adapter (o `TrophyService` não importa `OnlineService`), tudo best-effort/offline-first. Rank central assíncrono resolvido injetando o score recém-jogado nas linhas do servidor (elimina a corrida com o submit fire-and-forget). `src/core/` intocado.

**Tech Stack:** TypeScript estrito, `@preact/signals`, `@supabase/supabase-js`, Vitest.

## Global Constraints

- `src/core/` **NÃO** é tocado ⇒ determinismo **67 inalterado** (sem re-pin de goldens).
- Sem `any` sem justificativa; TS estrito.
- Offline-first: caminho online é **best-effort**, nunca lança; sem `.env` ⇒ jogo 100% local.
- `src/services/*` não importa DOM/Phaser; casca de IO (localStorage/supabase) isolada.
- REGRA 4: nenhuma string visível hardcoded; texto via chaves i18n nos 10 locales.
- Sem mudança de schema/DDL (tabela `trophies` já existe em 6.1).
- Upsert de `trophies` é **insert-only** (`ignoreDuplicates: true`) — RLS só tem `select_public` + `insert_own`, sem UPDATE.

---

### Task 1: seam de IO no `OnlineClient` (+ memory spy)

**Files:**
- Modify: `src/services/online/client.ts`
- Test: `tests/online/client.test.ts` (arquivo existente — adicionar casos)

**Interfaces:**
- Produces:
  - `OnlineClient.submitTrophies(playerId: string, ids: readonly string[]): Promise<void>`
  - `OnlineClient.fetchTrophies(playerId: string): Promise<readonly string[]>`
  - `MemoryOnlineClient.submittedTrophies: { playerId: string; ids: readonly string[] }[]`
  - `memoryOnlineClient({ ..., trophies?: string[] })` — `fetchTrophies` devolve `trophies ?? []`

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/online/client.test.ts` (adicionar bloco `describe`; imports já presentes no arquivo):

```ts
describe('memoryOnlineClient trophies', () => {
  it('registra submitTrophies e devolve fetchTrophies', async () => {
    const c = memoryOnlineClient({ trophies: ['firstFlight', 'forager'] });
    await c.submitTrophies('p1', ['centurion']);
    expect(c.submittedTrophies).toEqual([{ playerId: 'p1', ids: ['centurion'] }]);
    expect(await c.fetchTrophies('p1')).toEqual(['firstFlight', 'forager']);
  });

  it('fetchTrophies vazio por default', async () => {
    const c = memoryOnlineClient();
    expect(await c.fetchTrophies('p1')).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/online/client.test.ts`
Expected: FAIL (`submitTrophies`/`fetchTrophies` não existem em `OnlineClient`).

- [ ] **Step 3: Implementar**

Em `src/services/online/client.ts`:

Adicionar à interface `OnlineClient` (após `fetchVerifiedPlayers`):
```ts
  /** Insert-only dos troféus do jogador (idempotente; UPDATE não permitido pela RLS). */
  submitTrophies(playerId: string, ids: readonly string[]): Promise<void>;
  /** trophy_ids desbloqueados do jogador. */
  fetchTrophies(playerId: string): Promise<readonly string[]>;
```

Adicionar à interface `MemoryOnlineClient`:
```ts
  readonly submittedTrophies: { playerId: string; ids: readonly string[] }[];
```

Em `memoryOnlineClient`, adicionar `trophies?: string[]` ao tipo `opts`, e no corpo:
```ts
  const submittedTrophies: { playerId: string; ids: readonly string[] }[] = [];
```
Incluir `submittedTrophies` no objeto retornado e as duas funções:
```ts
    async submitTrophies(playerId, ids) {
      submittedTrophies.push({ playerId, ids });
    },
    async fetchTrophies() {
      return opts.trophies ?? [];
    },
```

Na casca real `createSupabaseClient`, adicionar ao objeto retornado:
```ts
    async submitTrophies(playerId, ids) {
      if (ids.length === 0) return;
      const rows = ids.map((trophy_id) => ({ player_id: playerId, trophy_id }));
      const { error } = await supabase
        .from(TABLES.trophies)
        .upsert(rows, { onConflict: 'player_id,trophy_id', ignoreDuplicates: true });
      if (error !== null) throw error;
    },
    async fetchTrophies(playerId) {
      const { data, error } = await supabase
        .from(TABLES.trophies)
        .select('trophy_id')
        .eq('player_id', playerId);
      if (error !== null) throw error;
      return ((data ?? []) as { trophy_id: string }[]).map((r) => r.trophy_id);
    },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/online/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/online/client.ts tests/online/client.test.ts
git commit -m "feat(6.5): seam submitTrophies/fetchTrophies no OnlineClient"
```

---

### Task 2: delegadores no `OnlineService`

**Files:**
- Modify: `src/services/online/index.ts`
- Test: `tests/online/service.test.ts` (adicionar casos; ver arquivo existente de OnlineService)

**Interfaces:**
- Consumes: `OnlineClient.submitTrophies`/`fetchTrophies` (Task 1), `memoryOnlineClient({trophies})`.
- Produces:
  - `OnlineService.submitTrophies(ids: readonly string[]): Promise<void>`
  - `OnlineService.fetchTrophies(): Promise<readonly string[]>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/online/service.trophies.test.ts` (padrão idêntico ao
`tests/online/onlineService.challenge.test.ts` existente — `fakeProfile()` com `signal({...})`):

```ts
import { describe, expect, it } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';
import { OnlineService } from '@services/online';
import { signal } from '@preact/signals';

function fakeProfile() {
  return { activeProfile: signal({ id: 'p1', name: 'Rex', createdAt: 0 }) };
}
const config = { url: 'x', anonKey: 'y' };

describe('OnlineService troféus', () => {
  it('submitTrophies anexa o próprio id quando online', async () => {
    const client = memoryOnlineClient({ uid: 'uid-1' });
    const svc = new OnlineService();
    await svc.init({ config, client, profile: fakeProfile() });
    await svc.submitTrophies(['centurion']);
    expect(client.submittedTrophies).toEqual([{ playerId: 'uid-1', ids: ['centurion'] }]);
    expect(await svc.fetchTrophies()).toEqual([]);
  });

  it('offline: submitTrophies é no-op e fetchTrophies vazio', async () => {
    const svc = new OnlineService();
    await svc.init({ config: null, client: null, profile: fakeProfile() });
    await expect(svc.submitTrophies(['centurion'])).resolves.toBeUndefined();
    expect(await svc.fetchTrophies()).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/online/service.trophies.test.ts`
Expected: FAIL (`submitTrophies`/`fetchTrophies` não existem em `OnlineService`).

- [ ] **Step 3: Implementar**

Em `src/services/online/index.ts`, adicionar métodos ao `OnlineService` (molde de `submitScore`/`fetchScores`):
```ts
  async submitTrophies(ids: readonly string[]): Promise<void> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return;
    if (ids.length === 0) return;
    try {
      await this.client.submitTrophies(id, ids);
    } catch {
      // best-effort
    }
  }

  async fetchTrophies(): Promise<readonly string[]> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return [];
    try {
      return await this.client.fetchTrophies(id);
    } catch {
      return [];
    }
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/online/service.trophies.test.ts`
Expected: PASS.

- [ ] **Step 5: `check` + commit**

```bash
npm run check && git add src/services/online/index.ts tests/online/service.trophies.test.ts
git commit -m "feat(6.5): OnlineService delega submit/fetch de troféus (best-effort)"
```

---

### Task 3: seam `TrophyOnline` + adapter

**Files:**
- Create: `src/services/trophy/online.ts`
- Create: `src/app/online/trophyAdapter.ts`
- Modify: `src/services/trophy/index.ts` (reexport do tipo, se o padrão do repo fizer isso)
- Test: `tests/services/trophy/online.test.ts`

**Interfaces:**
- Consumes: `OnlineService.submitTrophies`/`fetchTrophies` (Task 2).
- Produces:
  - `TrophyOnline { online: ReadonlySignal<boolean>; submitTrophies(ids): Promise<void>; fetchTrophies(): Promise<readonly string[]> }`
  - `MemoryTrophyOnline extends TrophyOnline { submitted: string[][]; setOnline(v: boolean): void }`
  - `memoryTrophyOnline({ online?, trophies? }): MemoryTrophyOnline`
  - `createTrophyOnline({ onlineSvc? }): TrophyOnline`

- [ ] **Step 1: Escrever o teste que falha**

`tests/services/trophy/online.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { memoryTrophyOnline } from '@services/trophy/online';

describe('memoryTrophyOnline', () => {
  it('registra submitted e devolve trophies', async () => {
    const o = memoryTrophyOnline({ online: true, trophies: ['forager'] });
    await o.submitTrophies(['centurion']);
    expect(o.submitted).toEqual([['centurion']]);
    expect(await o.fetchTrophies()).toEqual(['forager']);
    expect(o.online.value).toBe(true);
  });

  it('setOnline alterna o sinal', () => {
    const o = memoryTrophyOnline();
    expect(o.online.value).toBe(false);
    o.setOnline(true);
    expect(o.online.value).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/trophy/online.test.ts`
Expected: FAIL (módulo `online.ts` não existe).

- [ ] **Step 3: Implementar**

`src/services/trophy/online.ts` (molde de `src/services/leaderboard/online.ts`):
```ts
import { signal, type ReadonlySignal } from '@preact/signals';

export interface TrophyOnline {
  readonly online: ReadonlySignal<boolean>;
  submitTrophies(ids: readonly string[]): Promise<void>;
  fetchTrophies(): Promise<readonly string[]>;
}

export interface MemoryTrophyOnline extends TrophyOnline {
  readonly submitted: string[][];
  setOnline(v: boolean): void;
}

export function memoryTrophyOnline(
  opts: { online?: boolean; trophies?: readonly string[] } = {},
): MemoryTrophyOnline {
  const _online = signal(opts.online ?? false);
  const submitted: string[][] = [];
  return {
    online: _online,
    submitted,
    setOnline(v) {
      _online.value = v;
    },
    async submitTrophies(ids) {
      submitted.push([...ids]);
    },
    async fetchTrophies() {
      return opts.trophies ?? [];
    },
  };
}
```

`src/app/online/trophyAdapter.ts` (molde de `leaderboardAdapter.ts`):
```ts
import { onlineService } from '@services/online';
import type { TrophyOnline } from '@services/trophy/online';

interface OnlineTrophiesLike {
  readonly online: { readonly value: boolean };
  submitTrophies(ids: readonly string[]): Promise<void>;
  fetchTrophies(): Promise<readonly string[]>;
}

export function createTrophyOnline(deps: { onlineSvc?: OnlineTrophiesLike } = {}): TrophyOnline {
  const svc = (deps.onlineSvc ?? onlineService) as OnlineTrophiesLike;
  return {
    online: svc.online as TrophyOnline['online'],
    submitTrophies(ids) {
      return svc.submitTrophies(ids);
    },
    fetchTrophies() {
      return svc.fetchTrophies();
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/services/trophy/online.test.ts`
Expected: PASS.

- [ ] **Step 5: `check` + commit**

```bash
npm run check && git add src/services/trophy/online.ts src/app/online/trophyAdapter.ts tests/services/trophy/online.test.ts
git commit -m "feat(6.5): seam TrophyOnline + adapter (molde do leaderboard)"
```

---

### Task 4: `TrophyService` online-aware (push + merge + recordDailyPodium)

**Files:**
- Modify: `src/services/trophy/index.ts`
- Modify: `src/services/trophy/catalog.ts` (exportar `isKnownTrophyId`)
- Test: `tests/services/trophy/service.online.test.ts`

**Interfaces:**
- Consumes: `TrophyOnline`/`memoryTrophyOnline` (Task 3), `evaluate`/`recordMatch as recordMatchState` (store), `trophyById` (catalog), `PODIUM_RANK`.
- Produces:
  - `TrophyService.init(storage?, online?: TrophyOnline): void`
  - `TrophyService.recordDailyPodium(dailyRank: number): readonly string[]`
  - `recordMatch` continua devolvendo `readonly string[]`, agora com push best-effort.
  - `isKnownTrophyId(id: string): boolean` em `catalog.ts`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/services/trophy/service.online.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { TrophyService } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';
import { memoryTrophyOnline } from '@services/trophy/online';
import { initialTrophyState } from '@services/trophy/store';

const summary = { distance: 0, food: 0, nearMisses: 0, score: 0 };

describe('TrophyService online-aware', () => {
  it('recordMatch faz push dos recém-desbloqueados quando online', async () => {
    const online = memoryTrophyOnline({ online: true });
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(), online);
    svc.recordMatch(summary); // destrava firstFlight (gamesPlayed>=1)
    await Promise.resolve();
    expect(online.submitted.flat()).toContain('firstFlight');
  });

  it('offline: recordMatch não faz push', async () => {
    const online = memoryTrophyOnline({ online: false });
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(), online);
    svc.recordMatch(summary);
    await Promise.resolve();
    expect(online.submitted).toEqual([]);
  });

  it('recordDailyPodium destrava dailyPodium em rank<=3, não em rank>3', () => {
    const svc1 = new TrophyService();
    svc1.init(memoryTrophyStorage(), memoryTrophyOnline({ online: false }));
    expect(svc1.recordDailyPodium(2)).toContain('dailyPodium');

    const svc2 = new TrophyService();
    svc2.init(memoryTrophyStorage(), memoryTrophyOnline({ online: false }));
    expect(svc2.recordDailyPodium(5)).not.toContain('dailyPodium');
  });

  it('mergeFromServer une ids do servidor e faz push dos locais-só na borda online', async () => {
    // estado local começa com firstFlight já desbloqueado
    const storage = memoryTrophyStorage({
      stats: initialTrophyState().stats,
      unlocked: ['firstFlight'],
    });
    const online = memoryTrophyOnline({ online: false, trophies: ['forager'] });
    const svc = new TrophyService();
    svc.init(storage, online);
    online.setOnline(true); // borda offline→online dispara merge
    await Promise.resolve();
    await Promise.resolve();
    // servidor tinha 'forager' ⇒ agora local contém ambos
    expect(svc.unlockedIds.value).toEqual(expect.arrayContaining(['firstFlight', 'forager']));
    // 'firstFlight' era local-só ⇒ sobe ao servidor
    expect(online.submitted.flat()).toContain('firstFlight');
  });

  it('mergeFromServer filtra ids desconhecidos', async () => {
    const online = memoryTrophyOnline({ online: false, trophies: ['forager', 'BOGUS'] });
    const svc = new TrophyService();
    svc.init(memoryTrophyStorage(), online);
    online.setOnline(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(svc.unlockedIds.value).toContain('forager');
    expect(svc.unlockedIds.value).not.toContain('BOGUS');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/trophy/service.online.test.ts`
Expected: FAIL (`init` não aceita `online`; `recordDailyPodium` inexistente).

- [ ] **Step 3: Implementar**

Em `src/services/trophy/catalog.ts`, adicionar após `trophyById`:
```ts
export function isKnownTrophyId(id: string): boolean {
  return TROPHY_CATALOG.some((t) => t.id === id);
}
```

Reescrever `src/services/trophy/index.ts`:
```ts
import { signal, computed, effect, type ReadonlySignal } from '@preact/signals';
import {
  initialTrophyState,
  recordMatch as recordMatchState,
  evaluate,
  type MatchSummary,
  type TrophyState,
} from './store';
import { localStorageTrophyStorage, memoryTrophyStorage, type TrophyStorage } from './storage';
import { isKnownTrophyId } from './catalog';
import type { TrophyOnline } from './online';

export class TrophyService {
  private storage: TrophyStorage = memoryTrophyStorage();
  private readonly _state = signal<TrophyState>(initialTrophyState());
  private online: TrophyOnline | null = null;
  private disposeEffect: (() => void) | null = null;
  private lastOnline = false;

  readonly unlockedIds: ReadonlySignal<readonly string[]> = computed(() => this._state.value.unlocked);
  readonly unlockedCount: ReadonlySignal<number> = computed(() => this._state.value.unlocked.length);

  init(storage: TrophyStorage = localStorageTrophyStorage(), online?: TrophyOnline): void {
    this.storage = storage;
    this._state.value = storage.load();

    if (this.disposeEffect !== null) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.online = online ?? null;
    this.lastOnline = false;

    if (this.online !== null) {
      const o = this.online;
      this.disposeEffect = effect(() => {
        const isOnline = o.online.value; // assina
        if (isOnline && !this.lastOnline) {
          this.lastOnline = true;
          void this.mergeFromServer().catch(() => {}); // offline-first
        } else if (!isOnline) {
          this.lastOnline = false;
        }
      });
    }
  }

  /** Registra o resultado de uma partida; persiste se algo mudou. Retorna recém-desbloqueados. */
  recordMatch(m: MatchSummary, extra?: { readonly dailyRank?: number }): readonly string[] {
    const { state, newlyUnlocked } = recordMatchState(this._state.value, m, extra);
    this.commit(state); // stats sempre mudam (gamesPlayed++) ⇒ sempre persiste
    this.pushToServer(newlyUnlocked);
    return newlyUnlocked;
  }

  /** Reavalia só o pódio diário com o rank central. Push best-effort. */
  recordDailyPodium(dailyRank: number): readonly string[] {
    const { state, newlyUnlocked } = evaluate(this._state.value, {
      stats: this._state.value.stats,
      dailyRank,
    });
    if (newlyUnlocked.length > 0) {
      this.commit(state);
      this.pushToServer(newlyUnlocked);
    }
    return newlyUnlocked;
  }

  private pushToServer(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const o = this.online;
    if (o === null || !o.online.value) return;
    void o.submitTrophies(ids).catch(() => {}); // best-effort
  }

  private async mergeFromServer(): Promise<void> {
    const o = this.online;
    if (o === null || !o.online.value) return;
    const server = (await o.fetchTrophies()).filter(isKnownTrophyId);
    const local = this._state.value.unlocked;
    const union = [...new Set([...local, ...server])];
    if (union.length > local.length) {
      this.commit({ ...this._state.value, unlocked: union });
    }
    const localOnly = local.filter((id) => !server.includes(id));
    if (localOnly.length > 0) {
      void o.submitTrophies(localOnly).catch(() => {});
    }
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
export type { TrophyOnline } from './online';
```

> Nota: `evaluate` já é exportado por `store.ts` (confirmar; é usado por `recordMatch`). Se não estiver exportado, adicionar `export` na função `evaluate`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/services/trophy/service.online.test.ts`
Expected: PASS.

- [ ] **Step 5: `check` + suíte de troféus + commit**

```bash
npx vitest run tests/services/trophy/ && npm run check
git add src/services/trophy/index.ts src/services/trophy/catalog.ts tests/services/trophy/service.online.test.ts
git commit -m "feat(6.5): TrophyService online-aware (push + merge bidirecional + recordDailyPodium)"
```

---

### Task 5: `LeaderboardService.centralDailyRank` + seam `playerId`

**Files:**
- Modify: `src/services/leaderboard/online.ts` (adicionar `playerId` ao seam + double)
- Modify: `src/services/leaderboard/index.ts` (novo método)
- Modify: `src/app/online/leaderboardAdapter.ts` (ligar `playerId`)
- Test: `tests/services/leaderboard/centralRank.test.ts`

**Interfaces:**
- Consumes: `toCentralEntries` (central.ts), `MAX_ENTRIES` (store), `LeaderboardResult`.
- Produces:
  - `LeaderboardOnline.playerId: ReadonlySignal<string | null>`
  - `memoryLeaderboardOnline({ ..., playerId? })`
  - `LeaderboardService.centralDailyRank(result: LeaderboardResult): Promise<number | undefined>`

- [ ] **Step 1: Escrever o teste que falha**

`tests/services/leaderboard/centralRank.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { LeaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { memoryLeaderboardOnline } from '@services/leaderboard/online';
import type { OnlineScoreRow } from '@services/online/client';

function row(playerId: string, score: number): OnlineScoreRow {
  return {
    playerId, mode: 'daily', seed: 'daily:2026-07-16', score,
    distance: 0, food: 0, nearMisses: 0, level: 1,
    playerName: playerId, playerAvatar: '0', createdAt: 1000,
  };
}
const result = {
  mode: 'daily' as const, seed: 'daily:2026-07-16', score: 500,
  distance: 100, food: 5, nearMisses: 1, level: 2, achievedAt: 2000,
};

describe('centralDailyRank', () => {
  it('rank 1 quando meu score é o maior (inclui o sintético mesmo sem estar no servidor)', async () => {
    const online = memoryLeaderboardOnline({
      online: true, playerId: 'me',
      rows: { daily: [row('a', 300), row('b', 400)] },
      seeds: { daily: 'daily:2026-07-16', weekly: 'weekly:x' },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBe(1);
  });

  it('rank 3 atrás de dois scores maiores', async () => {
    const online = memoryLeaderboardOnline({
      online: true, playerId: 'me',
      rows: { daily: [row('a', 900), row('b', 700)] },
    });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBe(3); // me=500
  });

  it('undefined offline', async () => {
    const online = memoryLeaderboardOnline({ online: false, playerId: 'me' });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBeUndefined();
  });

  it('undefined sem playerId', async () => {
    const online = memoryLeaderboardOnline({ online: true, playerId: null });
    const svc = new LeaderboardService();
    svc.init(memoryLeaderboardStorage(), online);
    expect(await svc.centralDailyRank(result)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/services/leaderboard/centralRank.test.ts`
Expected: FAIL (`playerId` inexistente no double; `centralDailyRank` inexistente).

- [ ] **Step 3: Implementar**

Em `src/services/leaderboard/online.ts`:
- Adicionar à interface `LeaderboardOnline`: `readonly playerId: ReadonlySignal<string | null>;`
- Em `memoryLeaderboardOnline`, aceitar `playerId?: string | null` em `opts` e expor
  `playerId: signal(opts.playerId ?? null)` no retorno.

Em `src/services/leaderboard/index.ts`, importar `MAX_ENTRIES` do store e `OnlineScoreRow`:
```ts
import { MAX_ENTRIES, ... } from './store';
import type { OnlineScoreRow } from '@services/online/client';
```
Adicionar método:
```ts
  /** Rank 1-based do jogador no board diário central da seed do `result` (undefined se offline/sem id/fora do board). */
  async centralDailyRank(result: LeaderboardResult): Promise<number | undefined> {
    const o = this.online;
    if (o === null || !o.online.value || result.mode !== 'daily') return undefined;
    const myId = o.playerId.value;
    if (myId === null) return undefined;
    const rows = await o.fetchScores('daily', result.seed);
    const synthetic: OnlineScoreRow = {
      playerId: myId, mode: 'daily', seed: result.seed, score: result.score,
      distance: result.distance, food: result.food, nearMisses: result.nearMisses,
      level: result.level, playerName: '', playerAvatar: '', createdAt: result.achievedAt,
    };
    const entries = toCentralEntries([...rows, synthetic], MAX_ENTRIES);
    const idx = entries.findIndex((e) => e.playerId === myId);
    return idx >= 0 ? idx + 1 : undefined;
  }
```

Em `src/app/online/leaderboardAdapter.ts`, adicionar `playerId` ao objeto retornado e ao tipo
`OnlineScoresLike`:
```ts
interface OnlineScoresLike {
  readonly online: { readonly value: boolean };
  readonly globalPlayerId: { readonly value: string | null };
  // ...restante
}
// no retorno:
    playerId: svc.globalPlayerId as LeaderboardOnline['playerId'],
```
(o `onlineService` já expõe `globalPlayerId: ReadonlySignal<string|null>`.)

> Nota: confirmar que `LeaderboardResult` tem os campos `distance/food/nearMisses/level/achievedAt`
> (usados no sintético). Ver `src/services/leaderboard/store.ts:13`. Ajustar se algum nome diferir.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/services/leaderboard/centralRank.test.ts`
Expected: PASS.

- [ ] **Step 5: `check` + suíte de leaderboard + commit**

```bash
npx vitest run tests/services/leaderboard/ && npm run check
git add src/services/leaderboard/online.ts src/services/leaderboard/index.ts src/app/online/leaderboardAdapter.ts tests/services/leaderboard/centralRank.test.ts
git commit -m "feat(6.5): centralDailyRank (injeção do score jogado) + seam playerId"
```

---

### Task 6: fiação `onGameOver` + bootstrap + i18n

**Files:**
- Modify: `src/app/game/startGame.ts`
- Modify: `src/app/main.tsx`
- Modify: `src/i18n/locales/*.json` (10 arquivos — via skill `add-locale`)
- Test: (i18n já coberto por `tests/i18n/locales.test.ts`; a fiação é casca fina)

**Interfaces:**
- Consumes: `trophyService.recordDailyPodium` (Task 4), `leaderboardService.centralDailyRank` (Task 5), `createTrophyOnline` (Task 3).

- [ ] **Step 1: i18n — atualizar `dailyPodium.desc` nos 10 locales**

Usar a skill `add-locale` para editar a chave `trophy.dailyPodium.desc` removendo "local"
(o pódio é global quando online). Valor `en`: `"Finish top 3 on the Daily Challenge."` e
traduções nativas equivalentes nos outros 9 locales. Não criar chaves novas.

- [ ] **Step 2: Rodar guardas de i18n**

Run: `npx vitest run tests/i18n/`
Expected: PASS (paridade + scanner AST + allowlist).

- [ ] **Step 3: Fiar o bootstrap**

Em `src/app/main.tsx`:
- importar `createTrophyOnline` de `./online/trophyAdapter`.
- trocar `trophyService.init();` por `trophyService.init(undefined, createTrophyOnline());`.

- [ ] **Step 4: Reescrever a seção de troféu/pódio em `startGame.ts`**

Substituir o bloco atual (após `walletService.earn(...)`) por:
```ts
      const result = {
        mode,
        seed: match.seedLabel,
        score: w.score,
        distance: w.distance,
        food: w.food,
        nearMisses: w.nearMisses,
        level: w.level,
        achievedAt: Date.now(),
      };
      leaderboardService.recordMatch(result);

      const online = leaderboardService.centralAvailable.value;
      const localRank =
        mode === 'daily' && !online
          ? leaderboardService.dailyRankForSeed(match.seedLabel)
          : undefined;
      trophyService.recordMatch(
        { distance: w.distance, food: w.food, nearMisses: w.nearMisses, score: w.score },
        localRank !== undefined ? { dailyRank: localRank } : undefined,
      );
      if (mode === 'daily' && online) {
        void leaderboardService
          .centralDailyRank(result)
          .then((rank) => {
            if (rank !== undefined) trophyService.recordDailyPodium(rank);
          })
          .catch(() => {});
      }
```
(O bloco de `buildReplayPayload` / `submitChallengeEntry` mais abaixo permanece inalterado, mas
reusa `result`? Não — mantém o `Date.now()` próprio dele como estava. Não alterar essa parte.)

> Nota: garantir que `LeaderboardResult` é o tipo aceito por `recordMatch`/`centralDailyRank`;
> `result` acima já bate com o objeto que era passado inline antes.

- [ ] **Step 5: Verificação + commit**

```bash
npm run check && npm test
git add src/app/game/startGame.ts src/app/main.tsx src/i18n/locales/
git commit -m "feat(6.5): fia sync de troféus + pódio central no onGameOver; i18n dailyPodium global"
```

---

### Task 7: verificação final + docs

**Files:**
- Modify: `CLAUDE.md` (Estado atual)
- Modify: `docs/roadmap/PHASE-06-online-supabase.md` (marcar 6.5 `[x]`)

- [ ] **Step 1: Suíte completa + determinismo**

Run: `npm test && npm run check && npm run test:determinism`
Expected: tudo verde; determinismo **67 inalterado**.

- [ ] **Step 2: Confirmar core intocado**

Run: `git diff --name-only main... | grep '^src/core/' || echo 'CORE INTOCADO'`
Expected: `CORE INTOCADO`.

- [ ] **Step 3: Marcar item na fase + atualizar CLAUDE.md**

Editar `docs/roadmap/PHASE-06-online-supabase.md` item 6.5 para `[x]` com resumo do entregue.
Atualizar o bloco "Estado atual" do `CLAUDE.md` (parágrafo 6.5 + "Próximo: 6.6/…").

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/roadmap/PHASE-06-online-supabase.md
git commit -m "docs(6.5): marca troféus centrais concluído + Estado atual"
```

---

## Self-Review

- **Spec coverage:** Peça 1 (seam IO)→T1/T2; Peça 2 (TrophyOnline+adapter+service)→T3/T4; Peça 3 (centralDailyRank+playerId)→T5; Peça 4 (fiação)→T6; Peça 5 (i18n)→T6. Offline-first coberto por testes offline em T2/T4/T5. Determinismo→T7.
- **Placeholders:** nenhum; código completo em cada step.
- **Type consistency:** `submitTrophies(ids)`/`fetchTrophies()` consistentes T2↔T3↔T4; `centralDailyRank(result)`/`playerId` consistentes T5↔T6; `recordDailyPodium(rank)` T4↔T6.
- **Riscos anotados:** confirmar `evaluate` exportado por store (T4); confirmar campos de `LeaderboardResult` (T5); estilo do teste de `OnlineService` para montar `profile` (T2).
</content>
