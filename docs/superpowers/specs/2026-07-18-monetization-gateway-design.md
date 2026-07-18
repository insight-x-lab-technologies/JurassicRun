# 8.4 — Monetização real (gateway plugável) — Design

> Fase 8, item 8.4. Implementa o provider real de compra por trás do seam ADR-0004
> (`EntitlementProvider`/honor-system), mantendo honor-system como fallback.
> **`src/core/` NÃO é tocado ⇒ determinismo 67 inalterado.**

## Objetivo

Vender **moedas** (carteira, 4.5) e **expansões/packs** (entitlements, 4.6 / packs 8.3) por um
gateway de pagamento real, sem refatorar consumidores e sem custo/risco no lançamento. Offline-first:
sem gateway configurado, o jogo roda exatamente como hoje (honor-system).

## Decisão de produto (aprovada)

**Ko-Fi + código de resgate single-use, validado server-side por Edge Function.**

- Compra/doação acontece **no Ko-Fi** (externo, grátis, sem custo mensal, sem PCI/imposto do nosso
  lado — o vendedor de registro é o Ko-Fi). Casa com o ethos "hobby web sem custo" e com a letra do
  ADR-0004 ("packs desbloqueados por código de doação").
- Ao fulfillar um pedido, o dono do jogo entrega um **código de resgate** (string opaca) mapeado a um
  **SKU**. O jogador cola o código no jogo.
- Uma **Edge Function** (Deno, `service_role`, molde da 6.4) valida o código contra
  `jurassicrun.redemption_codes` (ledger de **uso único**), faz o claim atômico e devolve o SKU.
- O cliente aplica o SKU **localmente**: moedas → `walletService.earn`; expansão →
  grant no `entitlementsService` (+ seleciona). Carteira/entitlements seguem **locais** (como 4.5/4.6);
  o servidor é a autoridade só do **resgate** (uso único cross-device).

Rejeitados: Stripe (exige conta tipo-negócio, secrets, imposto/reembolso/PCI — contraria o ethos);
Ko-Fi Webhook auto-grant (exige endpoint público + config de webhook + carregar email/id do jogador na
compra — mais peça móvel do que o hobby precisa; o código single-use já protege).

## SKUs

Um catálogo puro mapeia SKU → efeito local:

| SKU              | Efeito                                    |
|------------------|-------------------------------------------|
| `coins:small`    | `walletService.earn(coins do pack `small` em `COIN_PACKS`)`  |
| `coins:medium`   | `walletService.earn(coins do pack `medium`)`                 |
| `coins:large`    | `walletService.earn(coins do pack `large`)`                  |
| `expansion:volcano` | unlock+select `volcano` no entitlements |
| `expansion:glacier` | unlock+select `glacier` no entitlements |

O SKU vem do **servidor** (não do cliente): o código é a única entrada do jogador; o servidor devolve
qual SKU aquele código concede. O catálogo do cliente só sabe **como aplicar** cada SKU conhecido; SKU
desconhecido ⇒ resultado `invalid` (nunca aplica efeito).

## Arquitetura (padrão puro×casca)

### Puro (testável, sem IO/DOM/phaser)
- **`src/services/purchase/sku.ts`** — `Sku` (union de literais), `SkuKind` (`coins`|`expansion`),
  `parseSku(raw): Sku | null` (valida contra o catálogo), `SKU_CATALOG` (mapa SKU → descritor de
  efeito `{kind, coins?}` / `{kind, expansionId?}`). Sem IO.
- **`src/services/purchase/apply.ts`** (ou dentro do service) — decisão pura `redemptionEffect(sku)` →
  descritor aplicável; o service casa o descritor com wallet/entitlements. (Mantém a lógica de "o que
  cada SKU faz" testável sem serviços reais.)

### Seam de IO
- **`src/services/purchase/gateway.ts`** — interface `RedemptionGateway`:
  ```ts
  interface RedeemResponse { ok: boolean; sku?: string; reason?: 'invalid' | 'used' | 'error'; }
  interface RedemptionGateway {
    readonly available: ReadonlySignal<boolean>; // há gateway real online? (reativo)
    redeem(code: string): Promise<RedeemResponse>;
  }
  ```
  - `available` é **signal** porque a disponibilidade acompanha o status online (6.3), que é reativo —
    um boolean estático contradiria isso.
  - `unavailableGateway`: `available=signal(false)`; `redeem` resolve `{ok:false, reason:'error'}` (nunca
    chamado pela UI quando `available=false`).
  - `memoryRedemptionGateway(codes)`: double de teste — `Map<code, sku>`, marca usado (2ª vez ⇒ `used`),
    código ausente ⇒ `invalid`; `available=signal(true)`.

### Casca (IO real, sem teste de unidade)
- **`src/services/online/client.ts`** — `OnlineClient.redeemCode(code: string): Promise<RedeemResponse>`
  via `supabase.functions.invoke('redeem-code', { body: { code } })` (usa a sessão anônima da 6.2 ⇒ o
  JWT vai no header; a Edge Function decodifica `auth.uid()` p/ registrar `redeemed_by`). Spy no
  `memoryOnlineClient` (`redeemResponses` programável + `redeemCalls`).
- **`src/app/purchase/gatewayAdapter.ts`** — `createRedemptionGateway(online = onlineService)`:
  `available = online.online.value` (config presente + sessão) — na verdade `available` reflete "config
  online existe"; delega `redeem` a `online.redeemCode`. Injetável.
- **`src/services/purchase/index.ts`** — `PurchaseService` reativo singleton (molde wallet/trophy):
  - sinal `available: ReadonlySignal<boolean>` = `gateway.available` (reativo ao status online).
  - `init(deps?)` injetável `{ gateway?, wallet?, entitlements? }` (defaults reais).
  - `redeem(code): Promise<PurchaseResult>` **best-effort, nunca lança**:
    1. `code` vazio ⇒ `invalid`.
    2. `!available` ⇒ `unavailable`.
    3. `await gateway.redeem(code)`; erro/rejeição ⇒ `error`.
    4. `ok:false` ⇒ mapeia `reason` (`invalid`/`used`/`error`).
    5. `ok:true`: `parseSku(sku)` — null ⇒ `error` (servidor mandou SKU que o cliente não conhece);
       senão aplica o efeito (`wallet.earn` / `entitlements.grantAndSelect`) e devolve `{status:'ok', sku}`.
  - `PurchaseResult = { status: 'ok'|'invalid'|'used'|'unavailable'|'error'; sku?: Sku }`.

### Grant sem provider
`entitlementsService` ganha `grantAndSelect(id)` (aplica `unlock` **ignorando** o provider — o servidor
já validou — e `select`), usado só pelo PurchaseService. O `unlock(id)` honor-system (via provider)
permanece intacto p/ o caminho de fallback do ExpansionsScreen.

## Edge Function `redeem-code`

Deno, `service_role` (único papel que enxerga `redemption_codes`; molde da `verify-challenge` 6.4).
POST `{ code }` (+ `auth.uid()` do JWT). Fluxo:
1. Normaliza o código (trim, upper).
2. `select sku, redeemed_by from redemption_codes where code = $1`.
3. Ausente ⇒ `{ ok:false, reason:'invalid' }`.
4. `redeemed_by not null` ⇒ `{ ok:false, reason:'used' }`.
5. Claim atômico `update ... set redeemed_by=$uid, redeemed_at=now() where code=$1 and redeemed_by is null`
   — 0 linhas afetadas (corrida) ⇒ `{ ok:false, reason:'used' }`; 1 linha ⇒ `{ ok:true, sku }`.

Erro inesperado ⇒ HTTP 200 `{ ok:false, reason:'error' }` (o cliente é best-effort). CORS liberado.
Artefatos: `index.ts` + `deno.json` + seção no `supabase/README.md` (deploy + como popular códigos).
**NÃO uso o bundle esbuild da 6.4** — esta função não importa `src/core/` (sem lógica de simulação),
só fala com o Postgres; é Deno puro autocontido.

## Schema (migração)

Nova migração idempotente `supabase/migrations/<ts>_redemption_codes.sql`:
```sql
create table if not exists jurassicrun.redemption_codes (
  code        text primary key,
  sku         text not null,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table jurassicrun.redemption_codes enable row level security;
-- Nenhuma policy p/ client ⇒ deny-by-default. Só service_role (Edge Function) acessa.
```
`src/services/online/schema.ts` ganha `redemption_codes` em `TABLES`/`TABLE_COLUMNS`; o teste de
contrato `tests/online/schema-contract.test.ts` passa a casar a nova tabela/colunas/RLS.

## UI

Componente compartilhado **`src/app/purchase/RedeemCodeForm.tsx`** (input controlado + botão + linha de
status i18n por `PurchaseResult`). Usado em:
- **ShopScreen**: `purchaseService.available` ⇒ mostra o `RedeemCodeForm` (moedas vêm por código) e
  **esconde** os botões honor-system de crédito instantâneo; `!available` ⇒ mantém os botões honor-system
  (comportamento atual). Nota i18n explica onde comprar (link Ko-Fi via `donate.ts`/`DONATE_URL`).
- **ExpansionsScreen**: `available` ⇒ premium desbloqueia pelo `RedeemCodeForm`; `!available` ⇒ botão
  honor-system `Unlock` atual.

**Semântica do fallback:** honor-system ativo **só** quando não há gateway — é o "fallback" do ADR-0004.
Com gateway, não há crédito grátis (senão a compra não faz sentido).

i18n: chaves `purchase.{redeemTitle,redeemPlaceholder,redeemButton,help}` +
`purchase.result.{ok,invalid,used,unavailable,error}` nos 10 locales (REGRA 4; paridade + scanner AST).

## Offline-first / determinismo

- Sem `.env`/config online ⇒ `available=false` ⇒ UI honor-system ⇒ jogo **idêntico** ao atual (testado).
- `src/core/` intocado; nenhuma bateria de determinismo afetada (**67 inalterado**, sem re-pin de goldens).
- Hot path do jogo não é tocado (compra é UI de menu, DOM estático — REGRA 3 trivial).

## Pré-requisitos do usuário (não automatizáveis nesta sessão)

Como Supabase na Fase 6 (o agente não tem service_role/senha nem conta de pagamento):
1. Aplicar a migração `redemption_codes` no banco.
2. `supabase functions deploy redeem-code`.
3. Criar conta Ko-Fi; ao fulfillar um pedido, inserir uma linha em `redemption_codes` (`code`, `sku`) e
   entregar o código ao comprador.
4. `.env` já preenchido (herdado de 6.2) p/ `available=true`.

Sem isso, 8.4 roda em honor-system (correto, offline-first).

## Fora de escopo (backlog/futuro)

- Ko-Fi Webhook auto-grant (peça móvel; código single-use já resolve).
- Geração automática de códigos / painel admin (usuário insere na tabela).
- Stripe/gateway com cartão direto (fora do ethos).
- Reembolso/estorno server-side.
- Entitlements/wallet **por-perfil** (hoje globais, como todo o resto — Fase futura).
