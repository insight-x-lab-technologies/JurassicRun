# 4.5 Economia persistente + Loja in-game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar uma carteira de moedas persistente e reativa; comida coletada vira moedas no Game Over; Ninho passa a debitar de verdade; e uma Loja in-game credita pacotes de moedas honor-system.

**Architecture:** Novo serviço `src/services/wallet/` no padrão puro×casca (store puro + storage localStorage injetável + `WalletService` reativo com sinal `balance`), espelhando `services/profile` e `services/nest`. O ganho de moedas entra por um hook `onGameOver` do `MatchController` (que continua puro), ligado na casca `startGame.ts`. `src/core/` NÃO é tocado ⇒ determinismo intacto.

**Tech Stack:** TypeScript estrito, Preact + `@preact/signals`, Vitest (+ happy-dom p/ componentes), i18next (10 locales).

## Global Constraints

- **Determinismo:** `src/core/` PROIBIDO tocar neste item. Sem `Math.random`/`Date.now` dentro de `src/core/`. A carteira e a conversão comida→moeda vivem em `src/services/`/`src/render`/`src/app`. Determinismo = 67 testes, deve permanecer **inalterado**.
- **i18n (REGRA 4):** nenhuma string visível hardcoded; toda chave nos **10** locales (`src/i18n/locales/{en,es,pt-BR,fr,it,de,ja,zh,ko,hi}.json`), paridade garantida por `tests/i18n/locales.test.ts`.
- **TypeScript estrito:** sem `any` sem justificativa; `exactOptionalPropertyTypes` ativo (montar objetos opcionais condicionalmente).
- **Carteira é GLOBAL** (não por-perfil) — espelha a decisão do Ninho.
- **Conversão comida→moeda = 1:1** (placeholder de tuning, Fase 8).
- **Verificação:** `npm run check` limpo e `npm test` verde ao fim de cada task.

---

### Task 1: Wallet store (lógica pura)

**Files:**
- Create: `src/services/wallet/store.ts`
- Test: `tests/services/wallet/store.test.ts` (convenção: testes vivem em `tests/` espelhando a árvore de `src/`; imports via alias `@services/*`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface WalletState { readonly coins: number }`
  - `initialWalletState(): WalletState` → `{ coins: 0 }`
  - `coinsForFood(food: number): number`
  - `addCoins(state: WalletState, amount: number): WalletState`
  - `spendCoins(state: WalletState, amount: number): { state: WalletState; ok: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/services/wallet/store.test.ts
import { describe, it, expect } from 'vitest';
import {
  initialWalletState,
  coinsForFood,
  addCoins,
  spendCoins,
  type WalletState,
} from '@services/wallet/store';

describe('wallet store', () => {
  it('initial state has zero coins', () => {
    expect(initialWalletState()).toEqual({ coins: 0 });
  });

  it('coinsForFood is 1:1, floored, non-negative', () => {
    expect(coinsForFood(0)).toBe(0);
    expect(coinsForFood(7)).toBe(7);
    expect(coinsForFood(3.9)).toBe(3);
    expect(coinsForFood(-5)).toBe(0);
    expect(coinsForFood(Number.NaN)).toBe(0);
  });

  it('addCoins adds, sanitizes invalid amounts, is immutable', () => {
    const s0 = initialWalletState();
    const s1 = addCoins(s0, 100);
    expect(s1).toEqual({ coins: 100 });
    expect(s0).toEqual({ coins: 0 }); // não mutou
    expect(addCoins(s1, -10)).toEqual({ coins: 100 }); // negativo ⇒ +0
    expect(addCoins(s1, Number.NaN)).toEqual({ coins: 100 });
    expect(addCoins(s1, 2.9)).toEqual({ coins: 102 }); // floor
  });

  it('spendCoins debits when affordable, is immutable', () => {
    const s: WalletState = { coins: 100 };
    const r = spendCoins(s, 30);
    expect(r).toEqual({ state: { coins: 70 }, ok: true });
    expect(s).toEqual({ coins: 100 });
  });

  it('spendCoins rejects insufficient / invalid amount without changing state', () => {
    const s: WalletState = { coins: 20 };
    expect(spendCoins(s, 50)).toEqual({ state: { coins: 20 }, ok: false });
    expect(spendCoins(s, -5)).toEqual({ state: { coins: 20 }, ok: false });
    expect(spendCoins(s, Number.NaN)).toEqual({ state: { coins: 20 }, ok: false });
    expect(spendCoins(s, 0)).toEqual({ state: { coins: 20 }, ok: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/wallet/store.test.ts`
Expected: FAIL (module `./store` não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/wallet/store.ts

/** Estado da carteira global de moedas. Sempre inteiro não-negativo. */
export interface WalletState {
  readonly coins: number;
}

export function initialWalletState(): WalletState {
  return { coins: 0 };
}

/** Saneia um valor para inteiro não-negativo (negativo/NaN/fração ⇒ floor≥0). */
function sanitizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

/** Converte comida coletada numa partida em moedas. 1:1 placeholder (tuning Fase 8). */
export function coinsForFood(food: number): number {
  return sanitizeAmount(food);
}

/** Adiciona moedas. `amount` inválido ⇒ soma 0. Imutável. */
export function addCoins(state: WalletState, amount: number): WalletState {
  return { coins: state.coins + sanitizeAmount(amount) };
}

/** Debita. Falha (ok:false, estado inalterado) se saldo insuficiente ou amount inválido. */
export function spendCoins(state: WalletState, amount: number): { state: WalletState; ok: boolean } {
  const value = sanitizeAmount(amount);
  if (value === 0 || value > state.coins) return { state, ok: false };
  return { state: { coins: state.coins - value }, ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/wallet/store.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/services/wallet/store.ts tests/services/wallet/store.test.ts
git commit -m "feat(4.5): wallet store puro (coinsForFood/addCoins/spendCoins)"
```

---

### Task 2: Wallet storage (persistência localStorage injetável)

**Files:**
- Create: `src/services/wallet/storage.ts`
- Test: `tests/services/wallet/storage.test.ts`

**Interfaces:**
- Consumes: `initialWalletState`, `WalletState` (Task 1).
- Produces:
  - `interface WalletStorage { load(): WalletState; save(s: WalletState): void }`
  - `const STORAGE_KEY = 'jurassicrun.wallet.v1'`
  - `memoryWalletStorage(initial?: WalletState): WalletStorage`
  - `localStorageWalletStorage(): WalletStorage`

- [ ] **Step 1: Write the failing test**

```ts
// tests/services/wallet/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  memoryWalletStorage,
  localStorageWalletStorage,
  STORAGE_KEY,
} from '@services/wallet/storage';

describe('wallet storage', () => {
  it('memory storage round-trips', () => {
    const s = memoryWalletStorage();
    expect(s.load()).toEqual({ coins: 0 });
    s.save({ coins: 42 });
    expect(s.load()).toEqual({ coins: 42 });
  });

  describe('localStorage storage', () => {
    beforeEach(() => localStorage.clear());

    it('empty key ⇒ initial state', () => {
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
    });

    it('round-trips through localStorage', () => {
      const s = localStorageWalletStorage();
      s.save({ coins: 123 });
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ coins: 123 });
      expect(localStorageWalletStorage().load()).toEqual({ coins: 123 });
    });

    it('invalid JSON ⇒ initial state', () => {
      localStorage.setItem(STORAGE_KEY, 'not json{');
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
    });

    it('wrong shape / negative / non-numeric coins ⇒ 0', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ coins: -9 }));
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ coins: 'x' }));
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
      localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
      expect(localStorageWalletStorage().load()).toEqual({ coins: 0 });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/wallet/storage.test.ts`
Expected: FAIL (módulo `./storage` não existe). (O ambiente de teste já usa happy-dom, que provê `localStorage`.)

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/wallet/storage.ts
import { initialWalletState, type WalletState } from './store';

export interface WalletStorage {
  load(): WalletState;
  save(state: WalletState): void;
}

export const STORAGE_KEY = 'jurassicrun.wallet.v1';

export function memoryWalletStorage(initial: WalletState = initialWalletState()): WalletStorage {
  let state = initial;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
}

function parseState(raw: string): WalletState {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return initialWalletState();
    const coins = (data as Record<string, unknown>).coins;
    if (typeof coins !== 'number' || !Number.isFinite(coins) || coins < 0) return initialWalletState();
    return { coins: Math.floor(coins) };
  } catch {
    return initialWalletState();
  }
}

export function localStorageWalletStorage(): WalletStorage {
  return {
    load(): WalletState {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? initialWalletState() : parseState(raw);
      } catch {
        return initialWalletState();
      }
    },
    save(state: WalletState): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, coins: state.coins }));
      } catch {
        // localStorage indisponível (modo privado); persistência é best-effort.
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/wallet/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/wallet/storage.ts tests/services/wallet/storage.test.ts
git commit -m "feat(4.5): wallet storage localStorage injetável + parseState robusto"
```

---

### Task 3: WalletService reativo + bootstrap

**Files:**
- Create: `src/services/wallet/index.ts`
- Test: `tests/services/wallet/index.test.ts`
- Modify: `src/app/main.tsx` (adicionar `walletService.init()` no bootstrap)

**Interfaces:**
- Consumes: `store.ts` + `storage.ts` (Tasks 1–2).
- Produces:
  - `const walletService` com:
    - `balance: ReadonlySignal<number>`
    - `init(storage?: WalletStorage): void`
    - `earn(amount: number): void`
    - `spend(amount: number): boolean`
  - re-export `coinsForFood` de `./store`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/services/wallet/index.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';

describe('WalletService', () => {
  beforeEach(() => walletService.init(memoryWalletStorage({ coins: 0 })));

  it('loads initial balance from storage', () => {
    walletService.init(memoryWalletStorage({ coins: 50 }));
    expect(walletService.balance.value).toBe(50);
  });

  it('earn adds coins and persists', () => {
    const storage = memoryWalletStorage({ coins: 0 });
    walletService.init(storage);
    walletService.earn(30);
    expect(walletService.balance.value).toBe(30);
    expect(storage.load()).toEqual({ coins: 30 });
  });

  it('spend debits and returns true when affordable', () => {
    walletService.init(memoryWalletStorage({ coins: 100 }));
    expect(walletService.spend(40)).toBe(true);
    expect(walletService.balance.value).toBe(60);
  });

  it('spend returns false and keeps balance when insufficient', () => {
    const storage = memoryWalletStorage({ coins: 10 });
    walletService.init(storage);
    expect(walletService.spend(50)).toBe(false);
    expect(walletService.balance.value).toBe(10);
    expect(storage.load()).toEqual({ coins: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/wallet/index.test.ts`
Expected: FAIL (módulo `./index` não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/wallet/index.ts
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialWalletState,
  addCoins,
  spendCoins,
  type WalletState,
} from './store';
import { localStorageWalletStorage, memoryWalletStorage, type WalletStorage } from './storage';

class WalletService {
  private storage: WalletStorage = memoryWalletStorage();
  private readonly _state = signal<WalletState>(initialWalletState());

  readonly balance: ReadonlySignal<number> = computed(() => this._state.value.coins);

  init(storage: WalletStorage = localStorageWalletStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Credita moedas (ganho de partida ou pacote da Loja) e persiste. */
  earn(amount: number): void {
    this.commit(addCoins(this._state.value, amount));
  }

  /** Debita moedas; retorna false (sem persistir) se o saldo não cobre. */
  spend(amount: number): boolean {
    const { state, ok } = spendCoins(this._state.value, amount);
    if (ok) this.commit(state);
    return ok;
  }

  private commit(state: WalletState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const walletService = new WalletService();
export { coinsForFood } from './store';
export type { WalletStorage } from './storage';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/wallet/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire bootstrap in `main.tsx`**

Em `src/app/main.tsx`, adicionar o import e o init (ao lado dos outros serviços):

```ts
import { nestService } from '@services/nest';
import { walletService } from '@services/wallet';   // NOVO
```

E dentro de `bootstrap()`, após `nestService.init();`:

```ts
  nestService.init();
  walletService.init();   // NOVO — antes de qualquer render que leia saldo
```

- [ ] **Step 6: Verify build & run tests**

Run: `npm run check && npx vitest run src/services/wallet/`
Expected: check limpo; todos os testes de wallet PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/wallet/index.ts tests/services/wallet/index.test.ts src/app/main.tsx
git commit -m "feat(4.5): WalletService reativo (signal balance) + init no bootstrap"
```

---

### Task 4: `onGameOver` hook do MatchController + ganho de moedas

**Files:**
- Modify: `src/render/match.ts` (adicionar hook `onGameOver`)
- Modify: `tests/render/match.test.ts` (novo teste do hook)
- Modify: `src/app/game/startGame.ts` (ligar hook → `walletService.earn`)

**Interfaces:**
- Consumes: `walletService.earn`, `coinsForFood` (Task 3); `WorldState` (`@core/sim`).
- Produces: `MatchHooks.onGameOver?: (world: WorldState) => void` disparado **1×** na transição `playing → dead`.

- [ ] **Step 1: Write the failing test**

Abrir `tests/render/match.test.ts` e adicionar um `it(...)` dentro do `describe('MatchController', ...)`. O arquivo já tem os helpers `makeFactory()` (mundo real com seed que cai e morre sem flap) e `advanceUntilDead(m)` (avança 1/60 até `dead`). Reuse-os:

```ts
  it('onGameOver dispara 1× na morte, com o world morto (food capturado)', () => {
    const deaths: number[] = [];
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onGameOver: (w) => deaths.push(w.food),
    });
    m.notifyFlap();            // ready → playing
    advanceUntilDead(m);       // roda steps até o mundo morrer ⇒ dead + hook
    expect(m.phase).toBe('dead');
    expect(m.world.alive).toBe(false);
    expect(deaths.length).toBe(1);
    m.advance(1 / 60);         // já morto: advance é no-op, não redispara
    expect(deaths.length).toBe(1);
  });

  it('onGameOver NÃO dispara em ready nem sem morrer', () => {
    let calls = 0;
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onGameOver: () => { calls++; },
    });
    m.advance(1);              // ready: no-op
    m.notifyFlap();            // playing
    m.advance(1 / 60);         // 1 step, mundo ainda vivo
    expect(m.world.alive).toBe(true);
    expect(calls).toBe(0);
  });
```

> Nota p/ o implementador: NÃO invente helpers novos — `makeFactory`/`advanceUntilDead`/`NullInputSource` já estão no topo do arquivo. `w.food` pode ser 0 no mundo de teste (sem coletáveis garantidos); o teste checa a **contagem de disparos** e o `world` morto, não o valor de food.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/match.test.ts`
Expected: FAIL (`onGameOver` ainda não existe / não é chamado).

- [ ] **Step 3: Implement the hook in `match.ts`**

Adicionar ao `MatchHooks`:

```ts
export interface MatchHooks {
  /** Disparado ao montar uma nova partida (a app liga em FlapInputSource.reset). */
  onNewMatch?: () => void;
  /** Disparado 1× na transição playing → dead (a app credita moedas da comida). */
  onGameOver?: (world: WorldState) => void;
}
```

E em `advance()`, na borda da morte:

```ts
  advance(dtSeconds: number): void {
    if (this._phase !== 'playing') return;
    this._loop.advance(dtSeconds);
    if (!this._world.alive) {
      this._phase = 'dead';
      this.hooks.onGameOver?.(this._world);
    }
  }
```

- [ ] **Step 4: Wire the app in `startGame.ts`**

Em `src/app/game/startGame.ts`, importar o serviço e ligar o hook:

```ts
import { walletService, coinsForFood } from '@services/wallet';
```

No `new MatchController(...)`, acrescentar `onGameOver` ao objeto de hooks:

```ts
  const match = new MatchController(
    flap,
    () => {
      const seed = randomEndlessSeed();
      return { world: createWorld({ seed, trait: nestService.activeTrait() }), seedLabel: seed };
    },
    {
      onNewMatch: () => flap.reset(),
      onGameOver: (w) => walletService.earn(coinsForFood(w.food)),
    },
  );
```

- [ ] **Step 5: Run tests & check**

Run: `npx vitest run src/render/match.test.ts && npm run check`
Expected: PASS; check limpo.

- [ ] **Step 6: Commit**

```bash
git add src/render/match.ts src/render/match.test.ts src/app/game/startGame.ts
git commit -m "feat(4.5): MatchController.onGameOver credita moedas da comida no Game Over"
```

---

### Task 5: Rewire do Ninho para a carteira real + Home

**Files:**
- Delete: `src/services/nest/wallet.ts` (seam morto)
- Modify: `src/services/nest/index.ts` (usar `walletService` em vez do seam)
- Modify: `tests/services/nest/service.test.ts` (teste do serviço nest existente) — compra debita/credita
- Modify: `src/app/screens/NestScreen.tsx` (saldo reativo via `walletService`)
- Modify: `src/app/home/stats.ts` (`getHomeStats.coins` = saldo real)

**Interfaces:**
- Consumes: `walletService.balance`, `walletService.spend` (Task 3); `purchase` puro do nest store (inalterado).
- Produces: Ninho debita a carteira em compras; Home mostra saldo real.

- [ ] **Step 1: Write/adjust the failing test (nest service)**

No teste do serviço nest existente (`tests/services/nest/service.test.ts`, que já exercita `nestService`), adicionar:

```ts
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';
import { memoryNestStorage } from './storage';

it('buy debits the wallet and grants the dino when affordable', () => {
  walletService.init(memoryWalletStorage({ coins: 1000 }));
  nestService.init(memoryNestStorage());
  const result = nestService.buy('goldbeak'); // price 150
  expect(result).toBe('ok');
  expect(walletService.balance.value).toBe(850);
  expect(nestService.ownedIds.value).toContain('goldbeak');
});

it('buy with insufficient balance neither debits nor grants', () => {
  walletService.init(memoryWalletStorage({ coins: 10 }));
  nestService.init(memoryNestStorage());
  const result = nestService.buy('goldbeak');
  expect(result).toBe('insufficient');
  expect(walletService.balance.value).toBe(10);
  expect(nestService.ownedIds.value).not.toContain('goldbeak');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/nest/`
Expected: FAIL (nest ainda usa o seam de saldo 0).

- [ ] **Step 3: Rewire `nest/index.ts`**

Trocar o import do seam pelo serviço de carteira e usar o saldo/débito reais:

```ts
// remover: import { getCoinBalance, spendCoins } from './wallet';
import { walletService } from '@services/wallet';
```

E o método `buy`:

```ts
  buy(id: string): PurchaseResult {
    const { state, result, spent } = purchase(this._state.value, id, walletService.balance.value);
    if (result === 'ok') {
      if (!walletService.spend(spent)) return 'insufficient'; // guarda extra contra corrida
      this.commit(state);
    }
    return result;
  }
```

Depois, **apagar** `src/services/nest/wallet.ts`.

- [ ] **Step 4: Rewire `NestScreen.tsx`**

Trocar a fonte do saldo:

```ts
// remover: import { getCoinBalance } from '@services/nest/wallet';
import { walletService } from '@services/wallet';
```

E dentro de `NestScreen()`:

```ts
  const balance = walletService.balance.value; // reativo: botões "comprar" habilitam ao ganhar moedas
```

- [ ] **Step 5: Rewire `getHomeStats`**

Em `src/app/home/stats.ts`:

```ts
import { walletService } from '@services/wallet';

export function getHomeStats(): HomeStats {
  return { coins: walletService.balance.value, trophies: 0, maxLevel: 1 };
}
```

Atualizar o comentário do seam para refletir que `coins` agora vem da carteira real (trophies/maxLevel seguem placeholders 4.7/Fase 5).

- [ ] **Step 6: Run tests & check**

Run: `npm run check && npx vitest run src/services/nest/`
Expected: check limpo (nenhuma referência restante a `nest/wallet`); testes PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/services/nest src/app/screens/NestScreen.tsx src/app/home/stats.ts
git commit -m "feat(4.5): Ninho debita a carteira real; Home mostra saldo real; remove seam nest/wallet"
```

---

### Task 6: Loja in-game (ShopScreen + pacotes honor-system + i18n)

**Files:**
- Create: `src/app/shop/packs.ts`
- Test: `tests/app/shop/packs.test.ts`
- Create: `src/app/screens/ShopScreen.tsx`
- Modify: `src/app/App.tsx` (rota `shop` → `ShopScreen`)
- Modify: `src/i18n/locales/*.json` (10 arquivos — chaves `shop.*`)
- Test: `tests/i18n/locales.test.ts` já valida paridade (não editar; deve continuar verde)

**Interfaces:**
- Consumes: `walletService.balance`, `walletService.earn` (Task 3); `i18n` (`@services/i18n`); `back` (`../router`).
- Produces: tela `shop` funcional que credita pacotes.

- [ ] **Step 1: Write the failing test (packs)**

```ts
// tests/app/shop/packs.test.ts
import { describe, it, expect } from 'vitest';
import { COIN_PACKS } from '@app/shop/packs';

describe('coin packs catalog', () => {
  it('has packs with unique ids and positive coin amounts', () => {
    expect(COIN_PACKS.length).toBeGreaterThan(0);
    const ids = COIN_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of COIN_PACKS) expect(p.coins).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/shop/packs.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implement `packs.ts`**

```ts
// src/app/shop/packs.ts

/** Pacote de moedas da Loja. Honor-system: crédito instantâneo, sem cobrança (gateway Fase 8). */
export interface CoinPack {
  readonly id: string;
  readonly coins: number;
}

/** Catálogo de pacotes. Valores placeholder de tuning (Fase 8). */
export const COIN_PACKS: readonly CoinPack[] = Object.freeze([
  { id: 'small', coins: 100 },
  { id: 'medium', coins: 500 },
  { id: 'large', coins: 1200 },
]);
```

- [ ] **Step 4: Add i18n keys (skill `add-locale`)**

Adicionar em **todos** os 10 locales (`src/i18n/locales/*.json`) um bloco `shop`. Valores em inglês (traduzir apropriadamente cada locale — o implementador usa a skill `add-locale` p/ garantir paridade). Estrutura (chaves e placeholders idênticos em todos):

```json
"shop": {
  "title": "Shop",
  "balance": "Balance: {{value}} coins",
  "coinPacks": "Coin Packs",
  "pack": "{{value}} coins",
  "grant": "Add",
  "honorNote": "Honor system — coins are added instantly, no payment. Real purchases come later.",
  "expansionsSoon": "Expansions arrive soon.",
  "back": "Back"
}
```

> O implementador DEVE traduzir de verdade para es/pt-BR/fr/it/de/ja/zh/ko/hi (não copiar o inglês), mantendo as MESMAS chaves e o placeholder `{{value}}`. `tests/i18n/locales.test.ts` falha se faltar chave em qualquer locale.

- [ ] **Step 5: Implement `ShopScreen.tsx`**

```tsx
// src/app/screens/ShopScreen.tsx
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { walletService } from '@services/wallet';
import { COIN_PACKS } from '../shop/packs';

export function ShopScreen(): VNode {
  const balance = walletService.balance.value;

  return (
    <div class="screen shop">
      <h1 class="screen__title">{i18n.t('shop.title')}</h1>
      <p class="shop__balance" data-testid="shop-balance">
        {i18n.t('shop.balance', { value: balance })}
      </p>

      <h2 class="shop__section">{i18n.t('shop.coinPacks')}</h2>
      <ul class="shop__packs">
        {COIN_PACKS.map((pack) => (
          <li key={pack.id} class="shop-pack" data-testid={`shop-pack-${pack.id}`}>
            <span class="shop-pack__amount">{i18n.t('shop.pack', { value: pack.coins })}</span>
            <button
              type="button"
              class="btn"
              data-testid={`shop-buy-${pack.id}`}
              onClick={() => walletService.earn(pack.coins)}
            >
              {i18n.t('shop.grant')}
            </button>
          </li>
        ))}
      </ul>
      <p class="shop__note">{i18n.t('shop.honorNote')}</p>
      <p class="shop__note shop__note--muted">{i18n.t('shop.expansionsSoon')}</p>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('shop.back')}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Wire route in `App.tsx`**

Importar e trocar o case `shop`:

```ts
import { ShopScreen } from './screens/ShopScreen';
```

```ts
    case 'shop':
      return <ShopScreen />;
```

- [ ] **Step 7: Run tests & check**

Run: `npm run check && npx vitest run tests/app/shop/ tests/i18n/`
Expected: check limpo; packs + paridade de locales PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/shop tests/app/shop src/app/screens/ShopScreen.tsx src/app/App.tsx src/i18n/locales
git commit -m "feat(4.5): Loja in-game (pacotes de moedas honor-system) + rota shop + i18n 10 locales"
```

---

## Verificação final da branch (após todas as tasks)

- [ ] `npm run check` — typecheck + lint limpos.
- [ ] `npm test` — suíte inteira verde (esperado ~+15 testes vs 408).
- [ ] `npm run test:determinism` (skill `verify-determinism`) — **67 determinismo intactos** (core não tocado).
- [ ] Review final da branch (`superpowers:requesting-code-review` / agente `reviewer`).
- [ ] Marcar 4.5 `[x]` em `docs/roadmap/PHASE-04-meta-offline.md`.
- [ ] Atualizar "Estado atual" em `CLAUDE.md`.

## Self-review (feito na escrita)

- **Cobertura do spec:** carteira persistente (T1–T3) ✓; comida→moeda no Game Over (T4) ✓; compra de dino debita (T5) ✓; Home saldo real (T5) ✓; Loja pacotes honor-system (T6) ✓; expansões explicitamente fora (T6 `expansionsSoon`) ✓; determinismo (verificação final) ✓.
- **Placeholders:** nenhum "TBD/TODO"; todo passo com código real. O único texto "traduzir de verdade" (T6) é instrução legítima da skill `add-locale`, com a estrutura de chaves fornecida.
- **Consistência de tipos:** `WalletState.coins`, `walletService.{balance,earn,spend}`, `coinsForFood`, `onGameOver(world)` usados de forma idêntica em T3–T6.
