# 5.4 Integridade — Replays verificáveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar `seed + InputTimeline + hash do estado final` da melhor tentativa de cada desafio (Diário/Semanal) e oferecer uma função pura que re-simula e verifica a integridade — o seam da verificação online da Fase 6.

**Architecture:** Captura da timeline no `FixedStepLoop` (grava cada `flap` consumido, auto-reset por partida). Store/serviço de replays em `src/services/replay/` (puro×casca, molde do leaderboard: dedup por seed, max score, top-10 por modo). Verificação pura reusa `simulate` + `hashState` do `@core/replay`. `src/core/` intocado ⇒ determinismo 67 inalterado.

**Tech Stack:** TypeScript estrito, Vitest, `@preact/signals`, localStorage.

## Global Constraints

- `src/core/` NÃO é tocado por este item. A verificação **reusa** `simulate` e `hashState` de `@core/replay` (já existentes). Determinismo permanece **67**, sem re-pin de goldens.
- TypeScript estrito, sem `any` sem justificativa. `exactOptionalPropertyTypes` está ligado (nunca passar `{campo: undefined}` explicitamente).
- REGRA 3 (performance): no hot path do `FixedStepLoop.advance`, gravar apenas um **booleano primitivo** por step (sem alocação de objeto). Montagem de `InputFrame[]` só no cold path (game-over).
- REGRA 4 (i18n): nenhuma string visível nova neste item (feature é meta/serviço, sem UI).
- Config de desafio (daily/weekly) reconstruída como `{ seed, trait: 'none' }` — dificuldade/clima usam defaults `true`. DEVE bater com `createMatchFactory` (src/render/matchFactory.ts).
- Escopo: só `mode` `'daily' | 'weekly'`. Endless fora do escopo (trait aleatório ⇒ config não reconstrutível só da seed).
- Padrões de storage: molde de `src/services/leaderboard/storage.ts` (chave versionada, `parseState` robusto, save/load best-effort).
- Serviço reativo singleton: molde de `src/services/leaderboard/index.ts`.

---

### Task 1: Captura da timeline no FixedStepLoop

**Files:**
- Modify: `src/render/loop.ts`
- Test: `tests/render/loop.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `InputSource.sample(): InputFrame` (já existe); `InputFrame` de `@core/sim`; `InputTimeline` de `@core/replay`.
- Produces: `FixedStepLoop.recordedTimeline(): InputTimeline` — devolve os frames consumidos, na ordem, um por step rodado desde a construção do loop.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `tests/render/loop.test.ts` (dentro do `describe('FixedStepLoop', ...)` ou num novo `describe`), importando `InputTimeline` de `@core/replay` no topo:

```typescript
import type { InputTimeline } from '@core/replay';

// ... dentro de describe('FixedStepLoop', ...) ou describe próprio:

it('loop recém-criado tem timeline gravada vazia', () => {
  const loop = new FixedStepLoop(tallWorld(), new NullInputSource());
  expect(loop.recordedTimeline()).toEqual([]);
});

it('grava exatamente um frame por step, igual ao que a fonte forneceu', () => {
  // fonte scriptada: flap true nos steps de índice par
  let i = 0;
  const scripted = { sample(): InputFrame { return { flap: i++ % 2 === 0 }; } };
  const loop = new FixedStepLoop(tallWorld(), scripted);
  const steps = loop.advance(FIXED_DT * 4);
  expect(steps).toBe(4);
  const timeline: InputTimeline = loop.recordedTimeline();
  expect(timeline).toEqual([
    { flap: true },
    { flap: false },
    { flap: true },
    { flap: false },
  ]);
});

it('não grava frames quando nenhum step completa (fração de dt)', () => {
  const scripted = { sample(): InputFrame { return { flap: true }; } };
  const loop = new FixedStepLoop(tallWorld(), scripted);
  loop.advance(FIXED_DT / 2);
  expect(loop.recordedTimeline()).toEqual([]);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- tests/render/loop.test.ts`
Expected: FAIL — `loop.recordedTimeline is not a function`.

- [ ] **Step 3: Implementar a gravação no loop**

Em `src/render/loop.ts`, adicionar o import de `InputTimeline`, o campo `recorded` e o método. O `sample()` é chamado 1×/step; grava-se o `flap` do frame consumido logo após o `step`.

Adicionar ao import do topo:
```typescript
import type { InputTimeline } from '@core/replay';
```

Adicionar o campo privado junto aos demais:
```typescript
  private readonly recorded: boolean[] = [];
```

Dentro de `advance`, no laço `while`, gravar o frame consumido. O corpo do laço passa a ser:
```typescript
    while (this.accumulator >= FIXED_DT) {
      this.prevX = pos.x; // snapshot 1 step atrás de `curr` (= pos após o step)
      this.prevY = pos.y;
      const frame = this.input.sample();
      this.recorded.push(frame.flap); // booleano primitivo (REGRA 3: sem alocação de objeto)
      step(this.world, frame);
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
```

Adicionar o método (perto de `alpha`/`renderX`):
```typescript
  /**
   * Timeline dos inputs consumidos até agora (um frame por step rodado). Montada sob demanda
   * (cold path — chamada no game-over), não no hot path. Loop fresco ⇒ timeline vazia.
   */
  recordedTimeline(): InputTimeline {
    return this.recorded.map((flap) => ({ flap }));
  }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- tests/render/loop.test.ts`
Expected: PASS (todos, incluindo os pré-existentes de slow-mo e amostragem).

- [ ] **Step 5: `npm run check`**

Run: `npm run check`
Expected: sem erros de tipo/lint.

- [ ] **Step 6: Commit**

```bash
git add src/render/loop.ts tests/render/loop.test.ts
git commit -m "feat(5.4): FixedStepLoop grava a InputTimeline consumida (auto-reset por partida)"
```

---

### Task 2: MatchController expõe a timeline gravada

**Files:**
- Modify: `src/render/match.ts`
- Test: `tests/render/match.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `FixedStepLoop.recordedTimeline()` (Task 1).
- Produces: `MatchController.recordedTimeline(): InputTimeline` — delega ao loop da partida corrente.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `tests/render/match.test.ts` (o helper `advanceUntilDead` já existe no arquivo). Importar `InputTimeline`:

```typescript
import type { InputTimeline } from '@core/replay';

// ... dentro de describe('MatchController', ...):

it('recordedTimeline reflete os steps rodados na partida', () => {
  const m = new MatchController(new NullInputSource(), makeFactory());
  m.notifyFlap(); // ready -> playing
  m.advance((1 / 60) * 3); // 3 steps
  const tl: InputTimeline = m.recordedTimeline();
  expect(tl).toHaveLength(3);
  expect(tl.every((f) => f.flap === false)).toBe(true); // NullInputSource
});

it('restart zera a timeline (loop fresco)', () => {
  const m = new MatchController(new NullInputSource(), makeFactory());
  m.notifyFlap();
  advanceUntilDead(m);
  expect(m.recordedTimeline().length).toBeGreaterThan(0);
  m.restart(); // nova partida
  expect(m.recordedTimeline()).toEqual([]);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- tests/render/match.test.ts`
Expected: FAIL — `m.recordedTimeline is not a function`.

- [ ] **Step 3: Implementar a delegação**

Em `src/render/match.ts`, adicionar o import e o método (perto dos getters). Adicionar ao import de tipos do topo:
```typescript
import type { InputTimeline } from '@core/replay';
```

Adicionar o método público (após o getter `seedLabel`):
```typescript
  /** Timeline dos inputs consumidos na partida corrente (para gravar o replay no game-over). */
  recordedTimeline(): InputTimeline {
    return this._loop.recordedTimeline();
  }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- tests/render/match.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/match.ts tests/render/match.test.ts
git commit -m "feat(5.4): MatchController.recordedTimeline delega ao loop da partida"
```

---

### Task 3: Store de replays (dedup por seed, max score, top-N)

**Files:**
- Create: `src/services/replay/store.ts`
- Test: `tests/services/replay/store.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (módulo puro folha).
- Produces:
  - `type ReplayMode = 'daily' | 'weekly'`
  - `interface StoredReplay { readonly mode: ReplayMode; readonly seed: string; readonly timeline: readonly boolean[]; readonly score: number; readonly distance: number; readonly food: number; readonly nearMisses: number; readonly finalHash: string; readonly achievedAt: number; }`
  - `interface ReplayState { readonly daily: readonly StoredReplay[]; readonly weekly: readonly StoredReplay[]; }`
  - `const MAX_REPLAYS = 10`
  - `function initialReplayState(): ReplayState`
  - `function sanitizeStat(n: number): number`
  - `function recordReplay(state: ReplayState, replay: StoredReplay): ReplayState`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/services/replay/store.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  initialReplayState,
  recordReplay,
  MAX_REPLAYS,
  type StoredReplay,
} from '@services/replay/store';

function replay(over: Partial<StoredReplay> = {}): StoredReplay {
  return {
    mode: 'daily',
    seed: 'daily:2026-07-08',
    timeline: [true, false, true],
    score: 100,
    distance: 50,
    food: 3,
    nearMisses: 1,
    finalHash: 'a'.repeat(32),
    achievedAt: 1000,
    ...over,
  };
}

describe('recordReplay', () => {
  it('estado inicial é vazio nos dois modos', () => {
    const s = initialReplayState();
    expect(s.daily).toEqual([]);
    expect(s.weekly).toEqual([]);
  });

  it('insere um replay no modo certo', () => {
    const s = recordReplay(initialReplayState(), replay());
    expect(s.daily).toHaveLength(1);
    expect(s.weekly).toHaveLength(0);
    expect(s.daily[0].seed).toBe('daily:2026-07-08');
  });

  it('dedup por seed: mantém o de maior score', () => {
    let s = recordReplay(initialReplayState(), replay({ score: 100, finalHash: 'x'.repeat(32) }));
    s = recordReplay(s, replay({ score: 250, finalHash: 'y'.repeat(32) }));
    expect(s.daily).toHaveLength(1);
    expect(s.daily[0].score).toBe(250);
    expect(s.daily[0].finalHash).toBe('y'.repeat(32));
  });

  it('tentativa que não supera o recorde do período ⇒ mesma ref (no-op)', () => {
    const first = recordReplay(initialReplayState(), replay({ score: 250 }));
    const second = recordReplay(first, replay({ score: 100 }));
    expect(second).toBe(first);
  });

  it('trunca a MAX_REPLAYS por modo, mantendo os maiores scores', () => {
    let s = initialReplayState();
    for (let i = 0; i < MAX_REPLAYS + 3; i++) {
      s = recordReplay(s, replay({ seed: `daily:d${i}`, score: i }));
    }
    expect(s.daily).toHaveLength(MAX_REPLAYS);
    const scores = s.daily.map((r) => r.score);
    expect(Math.min(...scores)).toBe(3); // os 3 menores (0,1,2) foram evictados
  });

  it('modos daily e weekly são independentes', () => {
    let s = recordReplay(initialReplayState(), replay({ mode: 'daily', seed: 'daily:x' }));
    s = recordReplay(s, replay({ mode: 'weekly', seed: 'weekly:y' }));
    expect(s.daily).toHaveLength(1);
    expect(s.weekly).toHaveLength(1);
  });

  it('saneia numéricos negativos/NaN para inteiro ≥ 0', () => {
    const s = recordReplay(initialReplayState(), replay({ score: -5, distance: NaN, food: 2.9 }));
    expect(s.daily[0].score).toBe(0);
    expect(s.daily[0].distance).toBe(0);
    expect(s.daily[0].food).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- tests/services/replay/store.test.ts`
Expected: FAIL — módulo `@services/replay/store` não existe.

- [ ] **Step 3: Implementar `src/services/replay/store.ts`**

```typescript
export type ReplayMode = 'daily' | 'weekly';

/** Replay verificável de uma tentativa: seed + timeline + âncora de integridade (hash final). */
export interface StoredReplay {
  readonly mode: ReplayMode;
  readonly seed: string;
  readonly timeline: readonly boolean[]; // flap por step de simulação
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly finalHash: string; // hashState(WorldState final) — o que a verificação recomputa
  readonly achievedAt: number;
}

export interface ReplayState {
  readonly daily: readonly StoredReplay[];
  readonly weekly: readonly StoredReplay[];
}

export const MAX_REPLAYS = 10;

export function initialReplayState(): ReplayState {
  return { daily: [], weekly: [] };
}

/** Saneia para inteiro não-negativo (NaN/negativo/∞/fração ⇒ floor ≥ 0). Molde do leaderboard. */
export function sanitizeStat(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function normalize(r: StoredReplay): StoredReplay {
  return {
    mode: r.mode,
    seed: r.seed,
    timeline: r.timeline,
    score: sanitizeStat(r.score),
    distance: sanitizeStat(r.distance),
    food: sanitizeStat(r.food),
    nearMisses: sanitizeStat(r.nearMisses),
    finalHash: r.finalHash,
    achievedAt: Number.isFinite(r.achievedAt) ? r.achievedAt : 0,
  };
}

/** Ordena por score desc; desempate achievedAt asc; depois seed (estabilidade total). */
function rank(list: StoredReplay[]): StoredReplay[] {
  return list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.achievedAt !== b.achievedAt) return a.achievedAt - b.achievedAt;
    return a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0;
  });
}

/** Dedup por seed (mantém maior score); insere e trunca top-N. Mesma ref se não melhora. */
function insert(list: readonly StoredReplay[], entry: StoredReplay): readonly StoredReplay[] {
  const existing = list.find((e) => e.seed === entry.seed);
  if (existing && entry.score <= existing.score) return list; // não melhora ⇒ no-op
  const without = existing ? list.filter((e) => e.seed !== entry.seed) : list;
  return rank([...without, entry]).slice(0, MAX_REPLAYS);
}

/** Grava um replay no modo certo. Imutável. Mesma ref se nada mudou. */
export function recordReplay(state: ReplayState, replay: StoredReplay): ReplayState {
  const entry = normalize(replay);
  const key = entry.mode; // 'daily' | 'weekly'
  const nextList = insert(state[key], entry);
  if (nextList === state[key]) return state;
  return { ...state, [key]: nextList };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- tests/services/replay/store.test.ts`
Expected: PASS.

- [ ] **Step 5: `npm run check`** (garante o alias `@services/replay/*` e os tipos)

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/services/replay/store.ts tests/services/replay/store.test.ts
git commit -m "feat(5.4): store puro de replays (dedup por seed, max score, top-N por modo)"
```

---

### Task 4: Verificação pura (`verifyReplay`)

**Files:**
- Create: `src/services/replay/verify.ts`
- Test: `tests/services/replay/verify.test.ts`

**Interfaces:**
- Consumes: `simulate`, `hashState`, `InputTimeline` de `@core/replay`; `StoredReplay` de `./store`.
- Produces:
  - `interface ReplayVerification { readonly valid: boolean; readonly expectedHash: string; readonly actualHash: string; }`
  - `function verifyReplay(replay: StoredReplay): ReplayVerification`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/services/replay/verify.test.ts`. Os testes constroem um replay HONESTO simulando de verdade (prova de determinismo viva) e depois adulteram.

```typescript
import { describe, it, expect } from 'vitest';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyReplay } from '@services/replay/verify';
import type { StoredReplay } from '@services/replay/store';

const SEED = 'daily:2026-07-08';

/** Constrói um StoredReplay honesto: simula {seed, trait:'none'} + timeline e ancora o hash. */
function honestReplay(): StoredReplay {
  const timeline = buildTimeline(120, (i) => i % 15 === 0); // flap esporádico
  const world = simulate({ seed: SEED, trait: 'none' }, timeline);
  return {
    mode: 'daily',
    seed: SEED,
    timeline: timeline.map((f) => f.flap),
    score: Math.floor(world.score),
    distance: Math.floor(world.distance),
    food: world.food,
    nearMisses: world.nearMisses,
    finalHash: hashState(world),
    achievedAt: 1000,
  };
}

describe('verifyReplay', () => {
  it('replay honesto ⇒ valid=true e hashes iguais', () => {
    const r = honestReplay();
    const v = verifyReplay(r);
    expect(v.valid).toBe(true);
    expect(v.actualHash).toBe(v.expectedHash);
    expect(v.actualHash).toBe(r.finalHash);
  });

  it('timeline adulterada (um flap virado) ⇒ valid=false', () => {
    const r = honestReplay();
    const tampered = [...r.timeline];
    tampered[0] = !tampered[0];
    const v = verifyReplay({ ...r, timeline: tampered });
    expect(v.valid).toBe(false);
    expect(v.actualHash).not.toBe(v.expectedHash);
  });

  it('seed trocada ⇒ valid=false (hash gravado não corresponde à nova seed)', () => {
    const r = honestReplay();
    const v = verifyReplay({ ...r, seed: 'daily:2020-01-01' });
    expect(v.valid).toBe(false);
  });

  it('hash final adulterado ⇒ valid=false', () => {
    const r = honestReplay();
    const v = verifyReplay({ ...r, finalHash: 'f'.repeat(32) });
    expect(v.valid).toBe(false);
    expect(v.expectedHash).toBe('f'.repeat(32));
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- tests/services/replay/verify.test.ts`
Expected: FAIL — módulo `@services/replay/verify` não existe.

- [ ] **Step 3: Implementar `src/services/replay/verify.ts`**

```typescript
import { simulate, hashState } from '@core/replay';
import type { InputTimeline } from '@core/replay';
import type { StoredReplay } from './store';

/** Resultado da verificação de integridade de um replay. */
export interface ReplayVerification {
  readonly valid: boolean;
  readonly expectedHash: string; // gravado no replay
  readonly actualHash: string; // recomputado re-simulando seed + timeline
}

/**
 * Re-simula um replay de desafio ({seed, trait:'none'} — dificuldade/clima nos defaults, DEVE
 * bater com createMatchFactory) e compara o hash do estado final com a âncora gravada.
 * Este é o seam da verificação online da Fase 6 (o servidor fará o mesmo com o dado submetido).
 */
export function verifyReplay(replay: StoredReplay): ReplayVerification {
  const timeline: InputTimeline = replay.timeline.map((flap) => ({ flap }));
  const world = simulate({ seed: replay.seed, trait: 'none' }, timeline);
  const actualHash = hashState(world);
  return {
    valid: actualHash === replay.finalHash,
    expectedHash: replay.finalHash,
    actualHash,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- tests/services/replay/verify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/replay/verify.ts tests/services/replay/verify.test.ts
git commit -m "feat(5.4): verifyReplay puro (re-simula seed+timeline, compara hash final)"
```

---

### Task 5: Storage (localStorage robusto) + ReplayService reativo

**Files:**
- Create: `src/services/replay/storage.ts`
- Create: `src/services/replay/index.ts`
- Test: `tests/services/replay/storage.test.ts`
- Test: `tests/services/replay/index.test.ts`

**Interfaces:**
- Consumes: `ReplayState`, `StoredReplay`, `initialReplayState`, `recordReplay`, `sanitizeStat`, `MAX_REPLAYS` de `./store`; `verifyReplay` de `./verify`.
- Produces:
  - `storage.ts`: `interface ReplayStorage { load(): ReplayState; save(state: ReplayState): void; }`, `const STORAGE_KEY = 'jurassicrun.replays.v1'`, `function memoryReplayStorage(initial?): ReplayStorage`, `function localStorageReplayStorage(): ReplayStorage`.
  - `index.ts`: `class ReplayService { readonly daily; readonly weekly; init(storage?): void; record(replay: StoredReplay): void; verify(replay: StoredReplay): ReplayVerification; }`, `const replayService: ReplayService`, e reexports de tipos (`StoredReplay`, `ReplayMode`, `ReplayVerification`, `ReplayStorage`).

- [ ] **Step 1: Escrever os testes de storage que falham**

Criar `tests/services/replay/storage.test.ts` (o pragma `happy-dom` na 1ª linha é obrigatório para `localStorage` — Vitest roda em `node` por default; molde do teste de storage do leaderboard):

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  localStorageReplayStorage,
  memoryReplayStorage,
  STORAGE_KEY,
} from '@services/replay/storage';
import { recordReplay, initialReplayState, type StoredReplay } from '@services/replay/store';

function replay(over: Partial<StoredReplay> = {}): StoredReplay {
  return {
    mode: 'daily', seed: 'daily:2026-07-08', timeline: [true, false, true],
    score: 100, distance: 50, food: 3, nearMisses: 1,
    finalHash: 'a'.repeat(32), achievedAt: 1000, ...over,
  };
}

describe('memoryReplayStorage', () => {
  it('round-trip save/load', () => {
    const st = memoryReplayStorage();
    const state = recordReplay(initialReplayState(), replay());
    st.save(state);
    expect(st.load()).toEqual(state);
  });
});

describe('localStorageReplayStorage', () => {
  beforeEach(() => localStorage.clear());

  it('sem chave ⇒ estado inicial', () => {
    expect(localStorageReplayStorage().load()).toEqual(initialReplayState());
  });

  it('round-trip: save persiste e load recupera', () => {
    const st = localStorageReplayStorage();
    const state = recordReplay(initialReplayState(), replay());
    st.save(state);
    expect(localStorageReplayStorage().load()).toEqual(state);
  });

  it('JSON inválido ⇒ estado inicial', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(localStorageReplayStorage().load()).toEqual(initialReplayState());
  });

  it('entrada com timeline não-booleana é filtrada', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        daily: [{ mode: 'daily', seed: 'daily:x', timeline: [1, 'nope'], score: 5, finalHash: 'a'.repeat(32) }],
        weekly: [],
      }),
    );
    expect(localStorageReplayStorage().load().daily).toEqual([]);
  });

  it('entrada sem seed é filtrada; entrada válida sobrevive', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        daily: [
          { seed: '', timeline: [true], finalHash: 'a'.repeat(32) },
          { mode: 'daily', seed: 'daily:ok', timeline: [true, false], score: 9, distance: 1, food: 0, nearMisses: 0, finalHash: 'b'.repeat(32), achievedAt: 5 },
        ],
        weekly: [],
      }),
    );
    const loaded = localStorageReplayStorage().load();
    expect(loaded.daily).toHaveLength(1);
    expect(loaded.daily[0].seed).toBe('daily:ok');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npm test -- tests/services/replay/storage.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/services/replay/storage.ts`**

```typescript
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
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npm test -- tests/services/replay/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever os testes do serviço que falham**

Criar `tests/services/replay/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ReplayService } from '@services/replay';
import { memoryReplayStorage } from '@services/replay/storage';
import { recordReplay, initialReplayState, type StoredReplay } from '@services/replay/store';

function replay(over: Partial<StoredReplay> = {}): StoredReplay {
  return {
    mode: 'daily', seed: 'daily:2026-07-08', timeline: [true, false, true],
    score: 100, distance: 50, food: 3, nearMisses: 1,
    finalHash: 'a'.repeat(32), achievedAt: 1000, ...over,
  };
}

describe('ReplayService', () => {
  it('init carrega o estado do storage', () => {
    const seeded = recordReplay(initialReplayState(), replay());
    const svc = new ReplayService();
    svc.init(memoryReplayStorage(seeded));
    expect(svc.daily.value).toHaveLength(1);
    expect(svc.daily.value[0].seed).toBe('daily:2026-07-08');
  });

  it('record grava e persiste; sinal reativo atualiza', () => {
    const storage = memoryReplayStorage();
    const svc = new ReplayService();
    svc.init(storage);
    svc.record(replay({ mode: 'weekly', seed: 'weekly:x' }));
    expect(svc.weekly.value).toHaveLength(1);
    expect(storage.load().weekly).toHaveLength(1);
  });

  it('record no-op (não supera) não persiste de novo (mesma ref de estado)', () => {
    const storage = memoryReplayStorage();
    const svc = new ReplayService();
    svc.init(storage);
    svc.record(replay({ score: 250 }));
    const afterFirst = storage.load();
    svc.record(replay({ score: 100 })); // mesma seed, score menor
    expect(storage.load()).toBe(afterFirst); // save não chamado de novo
  });

  it('verify delega para verifyReplay (hash inconsistente ⇒ inválido)', () => {
    const svc = new ReplayService();
    svc.init(memoryReplayStorage());
    // finalHash forjado não corresponde à re-simulação ⇒ inválido
    expect(svc.verify(replay({ finalHash: 'a'.repeat(32) })).valid).toBe(false);
  });
});
```

Nota: o storage de memória do teste no-op depende de `recordReplay` devolver a **mesma ref** de `ReplayState` quando não melhora (Task 3) ⇒ `ReplayService.record` não chama `save`. Como `memoryReplayStorage.save` substitui a ref interna, "não chamar save" preserva a ref anterior; o teste checa `toBe`.

- [ ] **Step 6: Rodar e confirmar que falham**

Run: `npm test -- tests/services/replay/index.test.ts`
Expected: FAIL — `ReplayService` não existe.

- [ ] **Step 7: Implementar `src/services/replay/index.ts`**

```typescript
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialReplayState,
  recordReplay,
  type ReplayState,
  type StoredReplay,
} from './store';
import { verifyReplay, type ReplayVerification } from './verify';
import {
  localStorageReplayStorage,
  memoryReplayStorage,
  type ReplayStorage,
} from './storage';

/**
 * Serviço reativo de replays verificáveis (molde do leaderboard). Grava seed+timeline+hash da
 * melhor tentativa de cada desafio e expõe a verificação de integridade (seam da Fase 6).
 */
export class ReplayService {
  private storage: ReplayStorage = memoryReplayStorage();
  private readonly _state = signal<ReplayState>(initialReplayState());

  readonly daily: ReadonlySignal<readonly StoredReplay[]> = computed(() => this._state.value.daily);
  readonly weekly: ReadonlySignal<readonly StoredReplay[]> = computed(() => this._state.value.weekly);

  init(storage: ReplayStorage = localStorageReplayStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Grava um replay; persiste só se o estado mudou de ref (no-op periódico não salva). */
  record(replay: StoredReplay): void {
    const next = recordReplay(this._state.value, replay);
    if (next === this._state.value) return;
    this._state.value = next;
    this.storage.save(next);
  }

  /** Re-simula e verifica a integridade do replay (delega ao verificador puro). */
  verify(replay: StoredReplay): ReplayVerification {
    return verifyReplay(replay);
  }
}

export const replayService = new ReplayService();

export { verifyReplay } from './verify';
export type { ReplayVerification } from './verify';
export type { StoredReplay, ReplayMode, ReplayState } from './store';
export type { ReplayStorage } from './storage';
```

- [ ] **Step 8: Rodar e confirmar que passam**

Run: `npm test -- tests/services/replay/`
Expected: PASS (store, verify, storage, index).

- [ ] **Step 9: `npm run check`**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add src/services/replay/storage.ts src/services/replay/index.ts tests/services/replay/storage.test.ts tests/services/replay/index.test.ts
git commit -m "feat(5.4): storage localStorage robusto + ReplayService reativo (record/verify)"
```

---

### Task 6: Fiação — gravar replay no game-over dos desafios

**Files:**
- Create: `src/app/game/replayPayload.ts` (helper puro — extraído para NÃO arrastar Phaser ao teste)
- Modify: `src/app/game/startGame.ts`
- Modify: `src/app/main.tsx`
- Test: `tests/app/game/replayPayload.test.ts` (novo)

**Interfaces:**
- Consumes: `MatchMode` de `@render/matchFactory`, `WorldState` de `@core/sim`, `hashState`/`InputTimeline` de `@core/replay`, `StoredReplay` de `@services/replay`.
- Produces: `buildReplayPayload(mode, seedLabel, world, timeline, achievedAt): StoredReplay | null` (retorna `null` fora de daily/weekly), importado por `startGame.ts` e testável sem Phaser.

**Nota de arquitetura:** `startGame.ts` importa `createGame` (que importa Phaser). Um teste que
importasse de `startGame.ts` carregaria Phaser no ambiente `node` do Vitest e quebraria. Por
isso o helper vive num módulo puro separado (`replayPayload.ts`); `startGame.ts` apenas o
importa e o fia no `onGameOver`. A fiação em si (casca fina) é verificada por Playwright na
etapa de verificação final.

- [ ] **Step 1: Escrever o teste que falha (payload puro)**

Criar `tests/app/game/replayPayload.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildReplayPayload } from '@app/game/replayPayload';
import { simulate, hashState, buildTimeline } from '@core/replay';
import { verifyReplay } from '@services/replay';

const SEED = 'daily:2026-07-08';

describe('buildReplayPayload', () => {
  it('endless ⇒ null (fora do escopo)', () => {
    const world = simulate({ seed: 'endless:X', trait: 'none' }, buildTimeline(10, () => false));
    expect(buildReplayPayload('endless', 'endless:X', world, buildTimeline(10, () => false), 1)).toBeNull();
  });

  it('daily ⇒ StoredReplay verificável (payload reproduz o hash do mundo final)', () => {
    const timeline = buildTimeline(90, (i) => i % 12 === 0);
    const world = simulate({ seed: SEED, trait: 'none' }, timeline);
    const payload = buildReplayPayload('daily', SEED, world, timeline, 42);
    expect(payload).not.toBeNull();
    expect(payload!.mode).toBe('daily');
    expect(payload!.seed).toBe(SEED);
    expect(payload!.timeline).toEqual(timeline.map((f) => f.flap));
    expect(payload!.finalHash).toBe(hashState(world));
    expect(payload!.achievedAt).toBe(42);
    // integridade ponta-a-ponta: o payload construído é válido
    expect(verifyReplay(payload!).valid).toBe(true);
  });

  it('weekly ⇒ mode weekly', () => {
    const timeline = buildTimeline(30, () => false);
    const world = simulate({ seed: 'weekly:2026-W28', trait: 'none' }, timeline);
    const payload = buildReplayPayload('weekly', 'weekly:2026-W28', world, timeline, 1);
    expect(payload!.mode).toBe('weekly');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- tests/app/game/replayPayload.test.ts`
Expected: FAIL — módulo `@app/game/replayPayload` não existe.

- [ ] **Step 3: Criar o helper puro `src/app/game/replayPayload.ts`**

```typescript
import { hashState } from '@core/replay';
import type { InputTimeline } from '@core/replay';
import type { WorldState } from '@core/sim';
import type { MatchMode } from '@render/matchFactory';
import type { StoredReplay } from '@services/replay';

/**
 * Monta o payload de replay verificável para uma partida de desafio (daily/weekly).
 * Retorna null para endless (fora do escopo do 5.4 — trait aleatório não reconstrutível só da seed).
 * Puro/testável sem Phaser. O `finalHash` ancora a integridade: verifyReplay re-simula
 * {seed, trait:'none'} + timeline e compara este hash.
 */
export function buildReplayPayload(
  mode: MatchMode,
  seedLabel: string,
  world: WorldState,
  timeline: InputTimeline,
  achievedAt: number,
): StoredReplay | null {
  if (mode !== 'daily' && mode !== 'weekly') return null;
  return {
    mode,
    seed: seedLabel,
    timeline: timeline.map((f) => f.flap),
    score: world.score,
    distance: world.distance,
    food: world.food,
    nearMisses: world.nearMisses,
    finalHash: hashState(world),
    achievedAt,
  };
}
```

- [ ] **Step 4: Fiar em `src/app/game/startGame.ts`**

Adicionar os imports no topo (junto dos demais):
```typescript
import { replayService } from '@services/replay';
import { buildReplayPayload } from './replayPayload';
```

No `onGameOver`, após o bloco do `trophyService.recordMatch(...)`, adicionar a gravação do replay:
```typescript
      const replay = buildReplayPayload(
        mode,
        match.seedLabel,
        w,
        match.recordedTimeline(),
        Date.now(),
      );
      if (replay) replayService.record(replay);
```

- [ ] **Step 5: Adicionar `replayService.init()` ao bootstrap em `src/app/main.tsx`**

Adicionar o import de `replayService` (junto dos demais serviços) e a chamada `init()`. A ordem
atual é `...trophyService.init(); leaderboardService.init(); ...`; inserir logo após
`leaderboardService.init()`:
```typescript
import { replayService } from '@services/replay';
// ...
  leaderboardService.init();
  replayService.init();
```

- [ ] **Step 6: Rodar o teste do payload e confirmar que passa**

Run: `npm test -- tests/app/game/replayPayload.test.ts`
Expected: PASS.

- [ ] **Step 7: `npm run check`**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/app/game/replayPayload.ts src/app/game/startGame.ts src/app/main.tsx tests/app/game/replayPayload.test.ts
git commit -m "feat(5.4): grava replay verificável no game-over de desafios (daily/weekly)"
```

---

### Task 7: Verificação final da suíte + determinismo

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: PASS — todos os testes, incluindo os novos de replay.

- [ ] **Step 2: Determinismo (deve permanecer inalterado — core intocado)**

Run: `npm run test:determinism`
Expected: PASS — **67** cenários, sem re-pin de goldens.

- [ ] **Step 3: Check final**

Run: `npm run check`
Expected: limpo.

- [ ] **Step 4: (sem commit — nada a mudar; a verificação é a evidência)**

---

## Self-Review (autor)

- **Cobertura da spec:** captura da timeline (Tasks 1–2), store dedup/max-score/top-N (Task 3), verificação pura via `simulate`+`hashState` (Task 4), storage robusto + serviço reativo (Task 5), fiação daily/weekly + `main.tsx` init (Task 6), verificação global + determinismo (Task 7). Escopo "só daily/weekly" respeitado no `buildReplayPayload` e no `onGameOver`.
- **Sem placeholders:** todo passo traz o código real.
- **Consistência de tipos:** `StoredReplay`/`ReplayState`/`ReplayMode` definidos na Task 3 e reusados idênticos nas Tasks 4–6; `recordedTimeline(): InputTimeline` consistente Task 1→2→6; `verifyReplay`/`ReplayVerification` Task 4→5. `sanitizeStat` reexportado de `store` e usado em `storage` (Task 5).
- **Core intocado:** nenhuma task modifica `src/core/` (só importa `simulate`/`hashState`/`buildTimeline`). Determinismo 67 preservado — checado na Task 7.
