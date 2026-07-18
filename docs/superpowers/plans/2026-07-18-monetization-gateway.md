# 8.4 — Monetização real (gateway plugável) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vender moedas e expansões por um gateway real (Ko-Fi + código de resgate single-use validado por Edge Function), mantendo honor-system como fallback, sem tocar `src/core/`.

**Architecture:** Padrão puro×casca (molde 6.3/6.4). Catálogo de SKU puro; seam `RedemptionGateway`; casca `OnlineClient.redeemCode` via Edge Function; `PurchaseService` reativo aplica o SKU local (wallet/entitlements); Edge Function `redeem-code` (Deno service_role) faz o claim atômico single-use contra `jurassicrun.redemption_codes`. UI compartilhada `RedeemCodeForm` substitui os botões honor-system quando o gateway está online.

**Tech Stack:** TypeScript estrito, `@preact/signals`, Preact (JSX via oxc), Vitest (+happy-dom p/ componentes), Supabase (`@supabase/supabase-js`, Edge Functions Deno), i18next.

## Global Constraints

- **`src/core/` NÃO é tocado** ⇒ determinismo **67 inalterado** (sem re-pin de goldens). Nenhuma task toca `src/core/`.
- **Offline-first:** sem config online (`.env` ausente) ⇒ `available=false` ⇒ UI honor-system ⇒ jogo idêntico ao atual.
- **i18n (REGRA 4):** nenhuma string visível hardcoded; toda chave nos 10 locales (`src/i18n/locales/*.json`); paridade + scanner AST verdes. Use a skill `add-locale` na task de UI.
- **TS estrito:** sem `any` sem justificativa; `exactOptionalPropertyTypes` ligado (montar objetos opcionais condicionalmente, nunca `{campo: undefined}`).
- **Best-effort:** todo caminho de rede nunca lança; falha ⇒ resultado degradado (`error`/`unavailable`), status não derruba.
- **Verificação por task:** `npm run check` (tsc+eslint) e `npm test` verdes antes do commit. Um commit por task.
- **Wire type único:** `RedeemResponse` é definido em `src/services/online/client.ts` e importado type-only pelos consumidores.

---

### Task 1: Schema — tabela `redemption_codes` + constantes + contrato

Cria a tabela do ledger de códigos (deny-by-default: só `service_role`), as constantes TS e estende a guarda de contrato SQL↔TS.

**Files:**
- Create: `supabase/migrations/20260718000000_redemption_codes.sql`
- Modify: `src/services/online/schema.ts`
- Modify: `tests/online/schema-contract.test.ts`

**Interfaces:**
- Produces: `REDEMPTION_TABLE = 'redemption_codes'`, `REDEMPTION_COLUMNS: readonly string[]` em `@services/online/schema`.

- [ ] **Step 1: Escreva o teste falho** — adicione ao final do `describe` em `tests/online/schema-contract.test.ts` (e ao import do topo, junte `REDEMPTION_TABLE, REDEMPTION_COLUMNS`):

```ts
  it('cria a tabela redemption_codes no schema dedicado', () => {
    expect(SQL).toContain(`create table if not exists ${SUPABASE_SCHEMA}.${REDEMPTION_TABLE} (`);
  });

  it('declara as colunas de redemption_codes', () => {
    const start = SQL.indexOf(`${SUPABASE_SCHEMA}.${REDEMPTION_TABLE} (`);
    const body = SQL.slice(start, SQL.indexOf(');', start));
    for (const col of REDEMPTION_COLUMNS) {
      expect(body, `redemption_codes.${col}`).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it('habilita RLS em redemption_codes sem policy de cliente (deny-by-default)', () => {
    expect(SQL).toMatch(
      new RegExp(`alter table ${SUPABASE_SCHEMA}\\.${REDEMPTION_TABLE}\\s+enable row level security`),
    );
    expect(SQL).not.toContain(`create policy ${REDEMPTION_TABLE}_select`);
    expect(SQL).not.toContain(`create policy ${REDEMPTION_TABLE}_insert`);
  });
```

- [ ] **Step 2: Rode o teste — deve FALHAR**

Run: `npx vitest run tests/online/schema-contract.test.ts`
Expected: FAIL (`REDEMPTION_TABLE` não exportado / SQL não contém a tabela).

- [ ] **Step 3: Adicione as constantes** em `src/services/online/schema.ts` (após o bloco `TABLE_COLUMNS`):

```ts
/** Tabela service-role-only (ledger de códigos de resgate, 8.4). Fora de TABLE_NAMES:
 *  deny-by-default, sem policy de cliente. */
export const REDEMPTION_TABLE = 'redemption_codes' as const;

export const REDEMPTION_COLUMNS: readonly string[] = [
  'code', 'sku', 'redeemed_by', 'redeemed_at', 'created_at',
];
```

- [ ] **Step 4: Escreva a migração** `supabase/migrations/20260718000000_redemption_codes.sql`:

```sql
-- 8.4 — Ledger de códigos de resgate (Ko-Fi). Single-use, service-role-only.
-- Idempotente (create-if-exists). Aplicar após 20260708000000_jr_schema.sql.

create table if not exists jurassicrun.redemption_codes (
  code        text primary key,
  sku         text not null,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table jurassicrun.redemption_codes enable row level security;

-- Sem policy de cliente: deny-by-default. Só a Edge Function (service_role) lê/grava.
```

- [ ] **Step 5: Rode o teste — deve PASSAR**

Run: `npx vitest run tests/online/schema-contract.test.ts`
Expected: PASS.

- [ ] **Step 6: `npm run check` limpo**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260718000000_redemption_codes.sql src/services/online/schema.ts tests/online/schema-contract.test.ts
git commit -m "feat(8.4): tabela redemption_codes (service-role-only) + guarda de contrato"
```

---

### Task 2: Catálogo de SKU puro

Fonte única dos SKUs vendáveis e de como cada um se aplica. Também vira a fonte única dos valores dos coin packs (a Loja passa a derivar daqui — import descendente app→service).

**Files:**
- Create: `src/services/purchase/sku.ts`
- Create: `tests/purchase/sku.test.ts`
- Modify: `src/app/shop/packs.ts`

**Interfaces:**
- Produces:
  - `type Sku` (union de 5 literais), `type SkuKind = 'coins' | 'expansion'`
  - `type SkuEffect = { kind: 'coins'; coins: number } | { kind: 'expansion'; expansionId: string }`
  - `parseSku(raw: string): Sku | null`
  - `skuEffect(sku: Sku): SkuEffect`
  - `COIN_SKU_AMOUNTS: { readonly small: number; readonly medium: number; readonly large: number }`

- [ ] **Step 1: Escreva o teste falho** `tests/purchase/sku.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSku, skuEffect, COIN_SKU_AMOUNTS } from '@services/purchase/sku';

describe('parseSku', () => {
  it('aceita SKUs conhecidos', () => {
    expect(parseSku('coins:small')).toBe('coins:small');
    expect(parseSku('expansion:volcano')).toBe('expansion:volcano');
  });
  it('rejeita SKU desconhecido, vazio ou lixo', () => {
    expect(parseSku('coins:huge')).toBeNull();
    expect(parseSku('expansion:classic')).toBeNull(); // classic é free, não vendável
    expect(parseSku('')).toBeNull();
    expect(parseSku('nonsense')).toBeNull();
  });
});

describe('skuEffect', () => {
  it('mapeia coins para o valor do pack', () => {
    expect(skuEffect('coins:medium')).toEqual({ kind: 'coins', coins: COIN_SKU_AMOUNTS.medium });
  });
  it('mapeia expansão para o id', () => {
    expect(skuEffect('expansion:glacier')).toEqual({ kind: 'expansion', expansionId: 'glacier' });
  });
});
```

- [ ] **Step 2: Rode — deve FALHAR**

Run: `npx vitest run tests/purchase/sku.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implemente** `src/services/purchase/sku.ts`:

```ts
/** SKUs vendáveis pelo gateway (8.4). `classic` é free ⇒ não é SKU. */
export type Sku =
  | 'coins:small'
  | 'coins:medium'
  | 'coins:large'
  | 'expansion:volcano'
  | 'expansion:glacier';

export type SkuKind = 'coins' | 'expansion';

export type SkuEffect =
  | { readonly kind: 'coins'; readonly coins: number }
  | { readonly kind: 'expansion'; readonly expansionId: string };

/** Fonte única dos valores dos coin packs (placeholders de tuning, Fase 8). */
export const COIN_SKU_AMOUNTS = { small: 100, medium: 500, large: 1200 } as const;

const CATALOG: Record<Sku, SkuEffect> = {
  'coins:small': { kind: 'coins', coins: COIN_SKU_AMOUNTS.small },
  'coins:medium': { kind: 'coins', coins: COIN_SKU_AMOUNTS.medium },
  'coins:large': { kind: 'coins', coins: COIN_SKU_AMOUNTS.large },
  'expansion:volcano': { kind: 'expansion', expansionId: 'volcano' },
  'expansion:glacier': { kind: 'expansion', expansionId: 'glacier' },
};

export function parseSku(raw: string): Sku | null {
  return Object.prototype.hasOwnProperty.call(CATALOG, raw) ? (raw as Sku) : null;
}

export function skuEffect(sku: Sku): SkuEffect {
  return CATALOG[sku];
}
```

- [ ] **Step 4: Refatore `src/app/shop/packs.ts`** para derivar de `COIN_SKU_AMOUNTS` (mantém a mesma forma `{id,coins}[]` que a ShopScreen consome):

```ts
import { COIN_SKU_AMOUNTS } from '@services/purchase/sku';

/** Pacote de moedas da Loja. Valores = fonte única em `@services/purchase/sku`. */
export interface CoinPack {
  readonly id: 'small' | 'medium' | 'large';
  readonly coins: number;
}

export const COIN_PACKS: readonly CoinPack[] = Object.freeze([
  { id: 'small', coins: COIN_SKU_AMOUNTS.small },
  { id: 'medium', coins: COIN_SKU_AMOUNTS.medium },
  { id: 'large', coins: COIN_SKU_AMOUNTS.large },
]);
```

- [ ] **Step 5: Rode os testes e o check — deve PASSAR**

Run: `npx vitest run tests/purchase/sku.test.ts && npm run check`
Expected: PASS + check limpo (a ShopScreen segue compilando: `COIN_PACKS` inalterado em forma).

- [ ] **Step 6: Commit**

```bash
git add src/services/purchase/sku.ts tests/purchase/sku.test.ts src/app/shop/packs.ts
git commit -m "feat(8.4): catálogo de SKU puro + coin packs derivam da fonte única"
```

---

### Task 3: Wire type `RedeemResponse` + seam `RedemptionGateway`

Define o tipo de resposta do resgate (na casca de client, junto dos outros wire types) e o seam com os doubles.

**Files:**
- Modify: `src/services/online/client.ts` (só adicionar o tipo `RedeemResponse` + método na interface — a casca real é a Task 4)
- Create: `src/services/purchase/gateway.ts`
- Create: `tests/purchase/gateway.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:
  - Em `@services/online/client`: `interface RedeemResponse { ok: boolean; sku?: string; reason?: 'invalid' | 'used' | 'error' }`
  - Em `@services/purchase/gateway`: `interface RedemptionGateway { readonly available: ReadonlySignal<boolean>; redeem(code: string): Promise<RedeemResponse> }`, `unavailableGateway: RedemptionGateway`, `memoryRedemptionGateway(codes: Record<string,string>): RedemptionGateway`

- [ ] **Step 1: Adicione o wire type** em `src/services/online/client.ts` — logo após `OnlineChallengeInput` (antes de `interface OnlineClient`):

```ts
/** Resposta do resgate de código (Edge Function `redeem-code`, 8.4). */
export interface RedeemResponse {
  readonly ok: boolean;
  readonly sku?: string;
  readonly reason?: 'invalid' | 'used' | 'error';
}
```

- [ ] **Step 2: Escreva o teste falho** `tests/purchase/gateway.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { memoryRedemptionGateway, unavailableGateway } from '@services/purchase/gateway';

describe('unavailableGateway', () => {
  it('não está disponível e recusa', async () => {
    expect(unavailableGateway.available.value).toBe(false);
    expect(await unavailableGateway.redeem('X')).toEqual({ ok: false, reason: 'error' });
  });
});

describe('memoryRedemptionGateway', () => {
  it('resgata um código conhecido uma única vez', async () => {
    const g = memoryRedemptionGateway({ GOLD: 'coins:medium' });
    expect(g.available.value).toBe(true);
    expect(await g.redeem('GOLD')).toEqual({ ok: true, sku: 'coins:medium' });
    expect(await g.redeem('GOLD')).toEqual({ ok: false, reason: 'used' });
  });
  it('recusa código desconhecido', async () => {
    const g = memoryRedemptionGateway({});
    expect(await g.redeem('NOPE')).toEqual({ ok: false, reason: 'invalid' });
  });
});
```

- [ ] **Step 3: Rode — deve FALHAR**

Run: `npx vitest run tests/purchase/gateway.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 4: Implemente** `src/services/purchase/gateway.ts`:

```ts
import { signal, type ReadonlySignal } from '@preact/signals';
import type { RedeemResponse } from '@services/online/client';

export interface RedemptionGateway {
  /** Há gateway real online? Reativo (acompanha o status online 6.3). */
  readonly available: ReadonlySignal<boolean>;
  redeem(code: string): Promise<RedeemResponse>;
}

const FALSE = signal(false);

/** Sem gateway configurado. A UI não chama `redeem` quando `available=false`. */
export const unavailableGateway: RedemptionGateway = {
  available: FALSE,
  redeem: async () => ({ ok: false, reason: 'error' }),
};

/** Double de teste: mapa código→SKU, uso único. */
export function memoryRedemptionGateway(codes: Record<string, string>): RedemptionGateway {
  const used = new Set<string>();
  const available = signal(true);
  return {
    available,
    redeem: async (code) => {
      if (!Object.prototype.hasOwnProperty.call(codes, code)) return { ok: false, reason: 'invalid' };
      if (used.has(code)) return { ok: false, reason: 'used' };
      used.add(code);
      return { ok: true, sku: codes[code] };
    },
  };
}
```

- [ ] **Step 5: Rode os testes e o check — deve PASSAR**

Run: `npx vitest run tests/purchase/gateway.test.ts && npm run check`
Expected: PASS + check limpo.

- [ ] **Step 6: Commit**

```bash
git add src/services/online/client.ts src/services/purchase/gateway.ts tests/purchase/gateway.test.ts
git commit -m "feat(8.4): wire type RedeemResponse + seam RedemptionGateway com doubles"
```

---

### Task 4: `OnlineClient.redeemCode` (casca) + delegador `OnlineService.redeemCode`

Estende o cliente Supabase com a chamada à Edge Function e o serviço online com o delegador best-effort.

**Files:**
- Modify: `src/services/online/client.ts` (interface `OnlineClient`, `MemoryOnlineClient`, `memoryOnlineClient`, `createSupabaseClient`)
- Modify: `src/services/online/index.ts` (delegador `redeemCode`)
- Modify: `tests/online/*` — criar `tests/online/redeem-client.test.ts`

**Interfaces:**
- Consumes: `RedeemResponse` (Task 3).
- Produces:
  - `OnlineClient.redeemCode(code: string): Promise<RedeemResponse>`
  - `memoryOnlineClient` opção `redeemResponses?: Record<string, RedeemResponse>` + spy `redeemCalls: string[]`
  - `OnlineService.redeemCode(code: string): Promise<RedeemResponse>` (best-effort; offline ⇒ `{ok:false, reason:'error'}`)

- [ ] **Step 1: Escreva o teste falho** `tests/online/redeem-client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { memoryOnlineClient } from '@services/online/client';

describe('memoryOnlineClient.redeemCode', () => {
  it('devolve a resposta programada e registra a chamada', async () => {
    const c = memoryOnlineClient({ redeemResponses: { GOLD: { ok: true, sku: 'coins:large' } } });
    expect(await c.redeemCode('GOLD')).toEqual({ ok: true, sku: 'coins:large' });
    expect(c.redeemCalls).toEqual(['GOLD']);
  });
  it('código sem resposta programada ⇒ invalid', async () => {
    const c = memoryOnlineClient({});
    expect(await c.redeemCode('NOPE')).toEqual({ ok: false, reason: 'invalid' });
  });
});
```

- [ ] **Step 2: Rode — deve FALHAR**

Run: `npx vitest run tests/online/redeem-client.test.ts`
Expected: FAIL (`redeemCode` não existe).

- [ ] **Step 3: Estenda a interface `OnlineClient`** em `client.ts` (após `fetchTrophies`):

```ts
  /** Resgata um código de compra via Edge Function `redeem-code`. */
  redeemCode(code: string): Promise<RedeemResponse>;
```

- [ ] **Step 4: Estenda `MemoryOnlineClient` e `memoryOnlineClient`** em `client.ts`:

Na interface `MemoryOnlineClient` adicione:
```ts
  readonly redeemCalls: string[];
```
No `opts` de `memoryOnlineClient` adicione o campo `redeemResponses?: Record<string, RedeemResponse>;`. No corpo, declare `const redeemCalls: string[] = [];`, inclua `redeemCalls` no objeto retornado e adicione o método:
```ts
    async redeemCode(code) {
      redeemCalls.push(code);
      const r = opts.redeemResponses?.[code];
      return r ?? { ok: false, reason: 'invalid' };
    },
```

- [ ] **Step 5: Implemente a casca real** em `createSupabaseClient` (novo método no objeto retornado):

```ts
    async redeemCode(code) {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { code },
      });
      if (error !== null) return { ok: false, reason: 'error' };
      const d = data as { ok?: boolean; sku?: string; reason?: string } | null;
      if (d?.ok === true && typeof d.sku === 'string') return { ok: true, sku: d.sku };
      const reason = d?.reason === 'invalid' || d?.reason === 'used' ? d.reason : 'error';
      return { ok: false, reason };
    },
```

- [ ] **Step 6: Adicione o delegador** em `src/services/online/index.ts` (após `fetchTrophies`, mesmo molde best-effort):

```ts
  async redeemCode(code: string): Promise<RedeemResponse> {
    if (this._status.value !== 'online' || this.client === null) {
      return { ok: false, reason: 'error' };
    }
    try {
      return await this.client.redeemCode(code);
    } catch {
      return { ok: false, reason: 'error' };
    }
  }
```

Garanta o import type: em `index.ts` junte `RedeemResponse` ao import de `'./client'`.

- [ ] **Step 7: Rode os testes e o check — deve PASSAR**

Run: `npx vitest run tests/online/redeem-client.test.ts && npm run check`
Expected: PASS + check limpo.

- [ ] **Step 8: Commit**

```bash
git add src/services/online/client.ts src/services/online/index.ts tests/online/redeem-client.test.ts
git commit -m "feat(8.4): OnlineClient.redeemCode (Edge Function invoke) + delegador best-effort"
```

---

### Task 5: `PurchaseService` + adapter + `entitlementsService.grantAndSelect`

O serviço que amarra tudo: recebe o código, delega ao gateway, aplica o SKU local. Adapter liga o gateway ao `onlineService`.

**Files:**
- Modify: `src/services/entitlements/index.ts` (novo método `grantAndSelect`)
- Create: `src/services/purchase/index.ts`
- Create: `src/app/purchase/gatewayAdapter.ts`
- Create: `tests/purchase/service.test.ts`
- Create: `tests/entitlements/grant-and-select.test.ts`

**Interfaces:**
- Consumes: `RedemptionGateway`, `memoryRedemptionGateway` (Task 3); `parseSku`, `skuEffect` (Task 2); `RedeemResponse` (Task 3).
- Produces:
  - `entitlementsService.grantAndSelect(id: string): void`
  - `type PurchaseStatus = 'ok' | 'invalid' | 'used' | 'unavailable' | 'error'`
  - `type PurchaseResult = { status: PurchaseStatus; sku?: Sku }`
  - `interface PurchaseDeps { gateway?: RedemptionGateway; wallet?: { earn(n: number): void }; entitlements?: { grantAndSelect(id: string): void } }`
  - `purchaseService` (singleton): `available: ReadonlySignal<boolean>`, `init(deps?: PurchaseDeps): void`, `redeem(code: string): Promise<PurchaseResult>`
  - `createRedemptionGateway(online?): RedemptionGateway` em `src/app/purchase/gatewayAdapter.ts`

- [ ] **Step 1: Escreva o teste falho de `grantAndSelect`** `tests/entitlements/grant-and-select.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';

describe('entitlementsService.grantAndSelect', () => {
  beforeEach(() => entitlementsService.init(memoryEntitlementsStorage()));
  it('desbloqueia e ativa sem passar pelo provider', () => {
    entitlementsService.grantAndSelect('volcano');
    expect(entitlementsService.unlockedIds.value).toContain('volcano');
    expect(entitlementsService.activeExpansion.value.id).toBe('volcano');
  });
});
```

- [ ] **Step 2: Rode — deve FALHAR**

Run: `npx vitest run tests/entitlements/grant-and-select.test.ts`
Expected: FAIL (método inexistente).

- [ ] **Step 3: Implemente `grantAndSelect`** em `src/services/entitlements/index.ts`. Junte `setActive` ao import de `'./store'`, e adicione o método na classe (após `select`):

```ts
  /**
   * Concede + ativa uma expansão IGNORANDO o provider (o servidor já validou a compra — 8.4).
   * Distinto de `unlock`, que passa pelo provider honor-system (fallback).
   */
  grantAndSelect(id: string): void {
    const { state } = unlockState(this._state.value, id);
    this.commit(setActive(state, id));
  }
```

- [ ] **Step 4: Rode — deve PASSAR**

Run: `npx vitest run tests/entitlements/grant-and-select.test.ts`
Expected: PASS.

- [ ] **Step 5: Escreva o teste falho do serviço** `tests/purchase/service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { purchaseService } from '@services/purchase';
import { memoryRedemptionGateway, unavailableGateway } from '@services/purchase/gateway';

function fakes() {
  const coins: number[] = [];
  const expansions: string[] = [];
  return {
    coins, expansions,
    wallet: { earn: (n: number) => coins.push(n) },
    entitlements: { grantAndSelect: (id: string) => expansions.push(id) },
  };
}

describe('purchaseService.redeem', () => {
  it('aplica coins de um SKU válido', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ A: 'coins:medium' }), wallet: f.wallet, entitlements: f.entitlements });
    const r = await purchaseService.redeem('A');
    expect(r).toEqual({ status: 'ok', sku: 'coins:medium' });
    expect(f.coins).toEqual([500]);
    expect(f.expansions).toEqual([]);
  });

  it('aplica expansão de um SKU válido', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ B: 'expansion:glacier' }), wallet: f.wallet, entitlements: f.entitlements });
    expect(await purchaseService.redeem('B')).toEqual({ status: 'ok', sku: 'expansion:glacier' });
    expect(f.expansions).toEqual(['glacier']);
  });

  it('código usado ⇒ used, sem aplicar', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ C: 'coins:small' }), wallet: f.wallet, entitlements: f.entitlements });
    await purchaseService.redeem('C');
    const r = await purchaseService.redeem('C');
    expect(r.status).toBe('used');
    expect(f.coins).toEqual([100]); // só a 1ª aplicou
  });

  it('código desconhecido ⇒ invalid', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({}), wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('Z')).status).toBe('invalid');
  });

  it('SKU desconhecido vindo do servidor ⇒ error, sem aplicar', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ D: 'coins:huge' }), wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('D')).status).toBe('error');
    expect(f.coins).toEqual([]);
  });

  it('código vazio ⇒ invalid sem chamar o gateway', async () => {
    const f = fakes();
    purchaseService.init({ gateway: memoryRedemptionGateway({ '': 'coins:small' }), wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('  ')).status).toBe('invalid');
    expect(f.coins).toEqual([]);
  });

  it('gateway indisponível ⇒ unavailable', async () => {
    const f = fakes();
    purchaseService.init({ gateway: unavailableGateway, wallet: f.wallet, entitlements: f.entitlements });
    expect((await purchaseService.redeem('A')).status).toBe('unavailable');
  });

  it('available reflete o gateway', () => {
    purchaseService.init({ gateway: unavailableGateway });
    expect(purchaseService.available.value).toBe(false);
    purchaseService.init({ gateway: memoryRedemptionGateway({}) });
    expect(purchaseService.available.value).toBe(true);
  });
});
```

- [ ] **Step 6: Rode — deve FALHAR**

Run: `npx vitest run tests/purchase/service.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 7: Implemente** `src/services/purchase/index.ts`:

```ts
import { signal, computed, type ReadonlySignal } from '@preact/signals';
import { walletService } from '@services/wallet';
import { entitlementsService } from '@services/entitlements';
import { parseSku, skuEffect, type Sku } from './sku';
import { unavailableGateway, type RedemptionGateway } from './gateway';

export type PurchaseStatus = 'ok' | 'invalid' | 'used' | 'unavailable' | 'error';
export interface PurchaseResult {
  readonly status: PurchaseStatus;
  readonly sku?: Sku;
}

interface WalletLike {
  earn(amount: number): void;
}
interface EntitlementsLike {
  grantAndSelect(id: string): void;
}
export interface PurchaseDeps {
  gateway?: RedemptionGateway;
  wallet?: WalletLike;
  entitlements?: EntitlementsLike;
}

class PurchaseService {
  private gateway: RedemptionGateway = unavailableGateway;
  private wallet: WalletLike = walletService;
  private entitlements: EntitlementsLike = entitlementsService;
  private readonly _available = signal<ReadonlySignal<boolean>>(unavailableGateway.available);

  /** Disponibilidade do gateway real (reativa). */
  readonly available: ReadonlySignal<boolean> = computed(() => this._available.value.value);

  init(deps: PurchaseDeps = {}): void {
    this.gateway = deps.gateway ?? unavailableGateway;
    this.wallet = deps.wallet ?? walletService;
    this.entitlements = deps.entitlements ?? entitlementsService;
    this._available.value = this.gateway.available;
  }

  /** Resgata um código. Best-effort: nunca lança. Só aplica o efeito em sucesso. */
  async redeem(code: string): Promise<PurchaseResult> {
    const trimmed = code.trim();
    if (trimmed === '') return { status: 'invalid' };
    if (!this.gateway.available.value) return { status: 'unavailable' };

    let response;
    try {
      response = await this.gateway.redeem(trimmed);
    } catch {
      return { status: 'error' };
    }

    if (!response.ok) {
      const reason = response.reason;
      if (reason === 'invalid' || reason === 'used') return { status: reason };
      return { status: 'error' };
    }

    const sku = response.sku !== undefined ? parseSku(response.sku) : null;
    if (sku === null) return { status: 'error' }; // servidor mandou SKU desconhecido: não aplica

    const effect = skuEffect(sku);
    if (effect.kind === 'coins') this.wallet.earn(effect.coins);
    else this.entitlements.grantAndSelect(effect.expansionId);
    return { status: 'ok', sku };
  }
}

export const purchaseService = new PurchaseService();
export type { Sku } from './sku';
```

- [ ] **Step 8: Implemente o adapter** `src/app/purchase/gatewayAdapter.ts`:

```ts
import { computed, type ReadonlySignal } from '@preact/signals';
import { onlineService } from '@services/online';
import type { RedemptionGateway } from '@services/purchase/gateway';
import type { RedeemResponse } from '@services/online/client';

interface OnlineRedeemLike {
  readonly online: ReadonlySignal<boolean>;
  redeemCode(code: string): Promise<RedeemResponse>;
}

/** Liga o gateway ao onlineService: disponível quando online; delega o resgate. */
export function createRedemptionGateway(online: OnlineRedeemLike = onlineService): RedemptionGateway {
  return {
    available: computed(() => online.online.value),
    redeem: (code) => online.redeemCode(code),
  };
}
```

- [ ] **Step 9: Rode todos os testes de compra e o check — deve PASSAR**

Run: `npx vitest run tests/purchase tests/entitlements/grant-and-select.test.ts && npm run check`
Expected: PASS + check limpo.

- [ ] **Step 10: Commit**

```bash
git add src/services/purchase/index.ts src/app/purchase/gatewayAdapter.ts src/services/entitlements/index.ts tests/purchase/service.test.ts tests/entitlements/grant-and-select.test.ts
git commit -m "feat(8.4): PurchaseService aplica SKU local + adapter + entitlements.grantAndSelect"
```

---

### Task 6: Edge Function `redeem-code` (Deno, service_role)

Valida e faz o claim atômico single-use. Casca não testada por unidade (molde `verify-challenge` 6.4); sem bundle esbuild (não importa `src/core/`).

**Files:**
- Create: `supabase/functions/redeem-code/index.ts`
- Create: `supabase/functions/redeem-code/deno.json`
- Modify: `supabase/README.md` (seção de deploy + como popular códigos)

**Interfaces:** nenhuma no TS do app (é infra Deno). Contrato HTTP: POST `{ code: string }` → 200 `{ ok: true, sku }` | `{ ok: false, reason: 'invalid'|'used'|'error' }`.

- [ ] **Step 1: Escreva `supabase/functions/redeem-code/deno.json`:**

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: Escreva `supabase/functions/redeem-code/index.ts`:**

```ts
// Edge Function: valida e resgata um código single-use (8.4).
// service_role: único papel que acessa jurassicrun.redemption_codes (deny-by-default).
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'jurassicrun' } },
    );

    // Quem está resgatando (best-effort; single-use é a proteção real).
    let redeemedBy: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      redeemedBy = data.user?.id ?? null;
    }

    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (code === '') return json({ ok: false, reason: 'invalid' });

    const { data: row, error: selErr } = await supabase
      .from('redemption_codes')
      .select('sku, redeemed_by')
      .eq('code', code)
      .maybeSingle();
    if (selErr) return json({ ok: false, reason: 'error' });
    if (!row) return json({ ok: false, reason: 'invalid' });
    if (row.redeemed_by) return json({ ok: false, reason: 'used' });

    // Claim atômico: só vence quem ainda vê redeemed_by null.
    const { data: claimed, error: updErr } = await supabase
      .from('redemption_codes')
      .update({ redeemed_by: redeemedBy, redeemed_at: new Date().toISOString() })
      .eq('code', code)
      .is('redeemed_by', null)
      .select('sku');
    if (updErr) return json({ ok: false, reason: 'error' });
    if (!claimed || claimed.length === 0) return json({ ok: false, reason: 'used' });

    return json({ ok: true, sku: row.sku });
  } catch {
    return json({ ok: false, reason: 'error' });
  }
});
```

- [ ] **Step 3: Documente** — adicione ao `supabase/README.md` uma seção `## redeem-code (8.4)`:

```markdown
## redeem-code (Edge Function, 8.4)

Valida códigos de resgate single-use (compras Ko-Fi). Deploy:

    supabase functions deploy redeem-code

Precisa das envs padrão da função (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — providas
pelo runtime). Ao fulfillar um pedido Ko-Fi, insira o código e o SKU na tabela:

    insert into jurassicrun.redemption_codes (code, sku)
    values ('ABC123', 'coins:medium');

SKUs válidos: `coins:small|medium|large`, `expansion:volcano|glacier`. O jogador cola o
código na Loja/Expansões; a função marca `redeemed_by`/`redeemed_at` no 1º resgate e recusa
os seguintes (`used`).
```

- [ ] **Step 4: `npm run check` (garante que nada do TS do app quebrou)**

Run: `npm run check`
Expected: sem erros (a função Deno não entra no `tsconfig` do app; confirme que não há erro de include).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/redeem-code/ supabase/README.md
git commit -m "feat(8.4): Edge Function redeem-code (claim atômico single-use) + docs"
```

---

### Task 7: UI — `RedeemCodeForm` + fiação ShopScreen/ExpansionsScreen + i18n + bootstrap

Componente de resgate compartilhado; honor-system some quando o gateway está online; wiring do `purchaseService` no bootstrap.

**Files:**
- Create: `src/app/purchase/RedeemCodeForm.tsx`
- Modify: `src/app/screens/ShopScreen.tsx`
- Modify: `src/app/screens/ExpansionsScreen.tsx`
- Modify: `src/app/main.tsx` (init do `purchaseService` com o adapter)
- Modify: `src/i18n/locales/*.json` (10 arquivos) — via skill `add-locale`
- Create: `tests/purchase/redeem-form.test.tsx`

**Interfaces:**
- Consumes: `purchaseService` (`available`, `redeem`), `createRedemptionGateway` (Tasks 5).
- Produces: `RedeemCodeForm` (Preact component, sem props).

- [ ] **Step 1: Adicione as chaves i18n** com a skill `add-locale` (garante os 10 locales + paridade + scanner AST). Chaves e valores `en`:

```
purchase.redeemTitle    = "Redeem a code"
purchase.redeemPlaceholder = "Paste your code"
purchase.redeemButton   = "Redeem"
purchase.help           = "Bought on Ko-fi? Paste the code you received."
purchase.result.ok      = "Redeemed! Your reward was applied."
purchase.result.invalid = "Invalid code."
purchase.result.used    = "This code was already redeemed."
purchase.result.unavailable = "Redeeming is unavailable right now."
purchase.result.error   = "Something went wrong. Try again."
```

Rode a suíte i18n: `npx vitest run tests/i18n` → PASS (paridade + scanner).

- [ ] **Step 2: Escreva o teste falho do componente** `tests/purchase/redeem-form.test.tsx` (happy-dom; molde dos testes de componente do 4.2 — signals+happy-dom exigem `await Promise.resolve()` p/ flush):

```tsx
// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { RedeemCodeForm } from '@app/purchase/RedeemCodeForm';
import { purchaseService } from '@services/purchase';
import { memoryRedemptionGateway } from '@services/purchase/gateway';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';
import { walletService } from '@services/wallet';
import { memoryWalletStorage } from '@services/wallet/storage';
import { i18n } from '@services/i18n';

describe('RedeemCodeForm', () => {
  beforeEach(async () => {
    await i18n.init();
    walletService.init(memoryWalletStorage());
    entitlementsService.init(memoryEntitlementsStorage());
    purchaseService.init({ gateway: memoryRedemptionGateway({ GOLD: 'coins:medium' }) });
  });

  it('resgata um código válido e mostra sucesso', async () => {
    const { getByTestId } = render(<RedeemCodeForm />);
    const input = getByTestId('redeem-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'GOLD' } });
    fireEvent.click(getByTestId('redeem-submit'));
    await Promise.resolve();
    await Promise.resolve();
    expect(getByTestId('redeem-status').textContent).toBe(i18n.t('purchase.result.ok'));
  });

  it('código inválido mostra erro de inválido', async () => {
    const { getByTestId } = render(<RedeemCodeForm />);
    fireEvent.input(getByTestId('redeem-input'), { target: { value: 'NOPE' } });
    fireEvent.click(getByTestId('redeem-submit'));
    await Promise.resolve();
    await Promise.resolve();
    expect(getByTestId('redeem-status').textContent).toBe(i18n.t('purchase.result.invalid'));
  });
});
```

- [ ] **Step 3: Rode — deve FALHAR**

Run: `npx vitest run tests/purchase/redeem-form.test.tsx`
Expected: FAIL (componente inexistente).

- [ ] **Step 4: Implemente** `src/app/purchase/RedeemCodeForm.tsx` (input controlado + ref no submit p/ evitar leitura stale — gotcha de 4.2):

```tsx
import type { VNode } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { i18n } from '@services/i18n';
import { purchaseService, type PurchaseStatus } from '@services/purchase';

export function RedeemCodeForm(): VNode {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<PurchaseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef('');
  codeRef.current = code;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await purchaseService.redeem(codeRef.current);
    setStatus(result.status);
    if (result.status === 'ok') setCode('');
    setBusy(false);
  }

  return (
    <form class="redeem" onSubmit={submit}>
      <h2 class="redeem__title">{i18n.t('purchase.redeemTitle')}</h2>
      <p class="redeem__help">{i18n.t('purchase.help')}</p>
      <div class="redeem__row">
        <input
          class="redeem__input"
          data-testid="redeem-input"
          type="text"
          value={code}
          placeholder={i18n.t('purchase.redeemPlaceholder')}
          onInput={(e) => setCode((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn" data-testid="redeem-submit" disabled={busy}>
          {i18n.t('purchase.redeemButton')}
        </button>
      </div>
      {status !== null && (
        <p class="redeem__status" data-testid="redeem-status">
          {i18n.t(`purchase.result.${status}`)}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Rode — deve PASSAR**

Run: `npx vitest run tests/purchase/redeem-form.test.tsx`
Expected: PASS.

- [ ] **Step 6: Fie a ShopScreen** — `src/app/screens/ShopScreen.tsx`: honor-buttons só quando `!available`; senão o `RedeemCodeForm`. Substitua o corpo:

```tsx
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { walletService } from '@services/wallet';
import { purchaseService } from '@services/purchase';
import { RedeemCodeForm } from '../purchase/RedeemCodeForm';
import { COIN_PACKS } from '../shop/packs';

export function ShopScreen(): VNode {
  const balance = walletService.balance.value;
  const gateway = purchaseService.available.value;

  return (
    <div class="screen shop">
      <h1 class="screen__title">{i18n.t('shop.title')}</h1>
      <p class="shop__balance" data-testid="shop-balance">
        {i18n.t('shop.balance', { value: balance })}
      </p>

      {gateway ? (
        <RedeemCodeForm />
      ) : (
        <>
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
        </>
      )}
      <p class="shop__note shop__note--muted">{i18n.t('shop.expansionsSoon')}</p>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('shop.back')}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Fie a ExpansionsScreen** — `src/app/screens/ExpansionsScreen.tsx`: quando `available`, o card premium bloqueado mostra o `RedeemCodeForm` (uma vez, abaixo do grid) em vez do botão honor `Unlock`; quando `!available`, mantém o botão honor. Ajuste:

No `ExpansionCard`, envolva o botão de unlock honor num flag: adicione prop `gateway: boolean` e troque o ramo final:
```tsx
      ) : gateway ? (
        <span class="expansion-card__badge expansion-card__badge--locked" data-testid={`expansion-locked-${exp.id}`}>
          {i18n.t('expansions.locked')}
        </span>
      ) : (
        <button
          type="button"
          class="btn"
          data-testid={`expansion-unlock-${exp.id}`}
          onClick={() => entitlementsService.unlock(exp.id)}
        >
          {i18n.t('expansions.unlock')}
        </button>
      )}
```
Em `ExpansionsScreen`, leia `const gateway = purchaseService.available.value;`, passe `gateway={gateway}` a cada card, e após o `</ul>` adicione `{gateway && <RedeemCodeForm />}`. Importe `purchaseService` e `RedeemCodeForm`. Adicione a chave i18n `expansions.locked = "Locked"` (via `add-locale`, 10 locales) no Step 1 — **inclua essa chave junto**.

- [ ] **Step 8: Fie o bootstrap** — em `src/app/main.tsx`, após os inits existentes (perfil/online/wallet/entitlements), adicione:

```ts
import { purchaseService } from '@services/purchase';
import { createRedemptionGateway } from './purchase/gatewayAdapter';
// ...após entitlementsService.init() e onlineService.init():
purchaseService.init({ gateway: createRedemptionGateway() });
```

(Consulte a ordem real dos inits no arquivo; `purchaseService.init` deve vir após `onlineService.init` e `entitlementsService.init`/`walletService.init`, pois o adapter lê `onlineService.online` e o serviço aplica em wallet/entitlements.)

- [ ] **Step 9: Rode a suíte inteira e o check — deve PASSAR**

Run: `npm run check && npm test`
Expected: check limpo; todos verdes (incluindo i18n e scanner AST). Determinismo inalterado (**67**), pois `src/core/` não foi tocado.

- [ ] **Step 10: Commit**

```bash
git add src/app/purchase/RedeemCodeForm.tsx src/app/screens/ShopScreen.tsx src/app/screens/ExpansionsScreen.tsx src/app/main.tsx src/i18n/locales tests/purchase/redeem-form.test.tsx
git commit -m "feat(8.4): RedeemCodeForm + Loja/Expansões via gateway, honor-system só offline"
```

---

## Self-Review (cobertura da spec)

- **Ko-Fi + código single-use** → Tasks 1 (ledger), 6 (Edge claim atômico). ✓
- **SKU (coins + expansão)** → Task 2 (catálogo puro). ✓
- **Seam `RedemptionGateway` + doubles** → Task 3. ✓
- **Casca `redeemCode` + delegador best-effort** → Task 4. ✓
- **`PurchaseService` aplica local + adapter + `grantAndSelect`** → Task 5. ✓
- **Honor-system só quando offline (fallback)** → Task 7 (gate por `available`). ✓
- **UI + i18n 10 locales** → Task 7 (skill `add-locale`, scanner AST). ✓
- **Offline-first / core intocado / det 67** → Global Constraints + nenhuma task toca `src/core/`. ✓
- **Pré-req do usuário (migração/deploy/Ko-Fi)** → doc na Task 6 + relatório final. ✓

Tipos consistentes: `RedeemResponse` (client.ts, Task 3) usado em 4/5; `PurchaseResult`/`PurchaseStatus` (Task 5) usados na UI (Task 7); `Sku`/`parseSku`/`skuEffect` (Task 2) em 5. `available` é signal em todo o caminho (gateway→service→UI). Sem placeholders.
