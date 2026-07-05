# 4.5 — Economia persistente + Loja in-game — Design

> Spec do item 4.5 do `docs/roadmap/PHASE-04-meta-offline.md`.
> Data: 2026-07-05. Modo autônomo (SDD).

## Objetivo

Ligar a **carteira de moedas persistente** que hoje é apenas um *seam* (`src/services/nest/
wallet.ts` com saldo 0 / débito no-op) a uma economia real:

1. **Carteira persistente** de moedas, reativa, sobrevive a reloads.
2. **Ganho de moedas** ao jogar: a **comida** coletada numa partida vira moedas ao **Game Over**.
3. **Compra de dinos** no Ninho passa a funcionar (débito real; o Ninho deixa de ser browse-only).
4. **Loja in-game**: tela `shop` com **pacotes de moedas honor-system** (crédito instantâneo,
   sem gateway de pagamento real).
5. **Home** exibe o saldo real de moedas (fecha o placeholder de `getHomeStats`).

## Escopo — o que NÃO entra (decisões de produto)

- **Expansões (compra/seleção)** ficam no **4.6**, que é o item dedicado
  (`EntitlementsService` honor-system/Ko-Fi + tela de Expansões — ADR-0004). Construir
  expansões agora forçaria o desenho prematuro de entitlements. A Loja do 4.5 cobre **só
  pacotes de moedas**; a UI aponta que expansões chegam no 4.6.
- **Carteira por-perfil.** A carteira é **global** (compartilhada entre perfis), espelhando a
  decisão já tomada no Ninho (hoje global; por-perfil adiado). Economia por-perfil/sync entra
  quando os perfis ganharem storage próprio (Fase 6).
- **Nível máx Endless / troféus** no `getHomeStats` continuam placeholders (4.7 / Fase 5). O
  4.5 só religa o campo `coins`.
- **Gateway de pagamento real** (compra de moeda com dinheiro) é honor-system agora; gateway
  plugável fica na Fase 8 (ADR-0004). Os pacotes creditam moedas na hora, sem cobrança.

## Determinismo

**`src/core/` NÃO é tocado.** A conversão comida→moedas e a carteira vivem na camada de
serviços/render (meta offline), fora da simulação. `world.food` já é um inteiro produzido
deterministicamente pelo core. Determinismo permanece intacto (67 testes); rodaremos
`verify-determinism` como prova, não porque há risco.

## Arquitetura

Novo serviço `src/services/wallet/`, no padrão **puro × casca** já usado em
`services/profile/` e `services/nest/`.

### `store.ts` (PURO — sem IO, sem aleatoriedade, sem `Date`)

```ts
export interface WalletState { readonly coins: number; }

export function initialWalletState(): WalletState;            // { coins: 0 }

/** Converte comida coletada numa partida em moedas. 1:1 placeholder (tuning Fase 8). */
export function coinsForFood(food: number): number;           // max(0, floor(food))

/** Adiciona moedas (amount saneado: negativos/NaN ⇒ 0). Imutável. */
export function addCoins(state: WalletState, amount: number): WalletState;

/** Debita. Falha (ok:false, estado inalterado) se saldo insuficiente ou amount inválido. */
export function spendCoins(state: WalletState, amount: number):
  { state: WalletState; ok: boolean };
```

- Todos os valores são inteiros não-negativos; `sanitizeAmount` clampa negativos/`NaN`/frações.
- `spendCoins` nunca deixa o saldo negativo; `addCoins`/`spendCoins` retornam **novo** estado.

### `storage.ts` (casca IO injetável — molde de `nest/storage.ts`)

```ts
export interface WalletStorage { load(): WalletState; save(s: WalletState): void; }
export const STORAGE_KEY = 'jurassicrun.wallet.v1';
export function memoryWalletStorage(initial?): WalletStorage;      // testes + fallback
export function localStorageWalletStorage(): WalletStorage;        // { version: 1, coins }
```

- `parseState` robusto: qualquer JSON/forma inválida ⇒ `initialWalletState()`; `coins` não
  numérico/negativo ⇒ 0. `save` best-effort (engole erro de storage indisponível).

### `index.ts` (`WalletService` reativo — singleton, molde de `profileService`/`nestService`)

```ts
class WalletService {
  readonly balance: ReadonlySignal<number>;   // computed do estado
  init(storage?: WalletStorage): void;         // default localStorage
  earn(amount: number): void;                  // addCoins + commit
  spend(amount: number): boolean;              // spendCoins; true se debitou
}
export const walletService = new WalletService();
```

- `commit(state)` = set-sinal + `storage.save` (idêntico ao padrão dos outros serviços).
- `main.tsx` chama `walletService.init()` no bootstrap (ao lado de `profileService.init()` /
  `nestService.init()`).

## Fluxo de dados

### Ganho: comida → moedas no Game Over

`MatchController` (`src/render/match.ts`, PURO) ganha um hook:

```ts
export interface MatchHooks {
  onNewMatch?: () => void;
  onGameOver?: (world: WorldState) => void;   // NOVO — disparado 1× na transição p/ dead
}
```

- Em `advance()`, quando `!this._world.alive` faz a transição `playing → dead`, chama
  `this.hooks.onGameOver?.(this._world)` **exatamente 1×** (na borda da transição, não por
  frame). MatchController continua puro (não importa serviços).
- `startGame.ts` (casca) liga o hook:
  `onGameOver: (w) => walletService.earn(coinsForFood(w.food))`.
- Consequência: moeda é "bancada" ao morrer. Sair de Play no meio da partida (unmount) **não**
  banca — precisa morrer. Aceito (simples e previsível).

### Gasto: compra de dino no Ninho

- Remove o *seam* `src/services/nest/wallet.ts`.
- `NestService.buy(id)` passa a consultar `walletService.balance.value` e, no `ok`, chamar
  `walletService.spend(def.price)` (que debita e persiste). A ordem de `purchase()` puro
  (valida saldo) + `spend()` (debita) fica no serviço; `spend` devolve boolean como guarda
  extra contra corrida (se falhar, não credita o dino).
- `NestScreen.tsx` lê `walletService.balance.value` (reativo) para o saldo e para desabilitar
  os botões "comprar" — os botões **habilitam ao vivo** quando o saldo cobre o preço.

### Home

- `getHomeStats()` (`src/app/home/stats.ts`) passa a devolver
  `{ coins: walletService.balance.value, trophies: 0, maxLevel: 1 }`. Chamado no corpo do
  render da `HomeScreen` ⇒ o chip de moedas reage a mudanças de saldo.

## Loja (`ShopScreen`)

- Rota `shop` deixa de ser `PlaceholderScreen` e passa a renderizar `ShopScreen.tsx`.
- Catálogo puro de pacotes em `src/app/shop/packs.ts`:

```ts
export interface CoinPack { readonly id: string; readonly coins: number; }
export const COIN_PACKS: readonly CoinPack[];   // ex.: +100, +500, +1200 (placeholders)
```

- `ShopScreen` mostra o **saldo atual** (`walletService.balance.value`) + a lista de pacotes;
  cada pacote tem um botão que chama `walletService.earn(pack.coins)` (honor-system: crédito
  instantâneo). Um aviso i18n deixa claro que é placeholder sem cobrança real (gateway → Fase 8).
- Botão **Voltar** (padrão das telas).

## i18n (REGRA 4 — 10 locales)

Chaves novas (via skill `add-locale`, paridade garantida pelo teste de locales):

- `shop.title`, `shop.balance` (`{{value}}`), `shop.coinPacks`, `shop.grant` (rótulo do botão,
  ex.: "Adicionar"), `shop.pack` (`{{value}}` moedas), `shop.honorNote` (aviso honor-system),
  `shop.back`, `shop.expansionsSoon` (nota de que expansões chegam no 4.6).

Nenhuma string visível hardcoded.

## Testes

- **`store.test.ts`** (puro): `coinsForFood` (1:1, floor, negativo⇒0); `addCoins`
  (saneia negativo/NaN, imutável); `spendCoins` (debita, rejeita insuficiente, rejeita
  inválido, imutável, nunca negativo); `initialWalletState`.
- **`storage.test.ts`**: round-trip memory + localStorage (mock); `parseState` robusto
  (JSON inválido, forma errada, coins negativo/não-numérico ⇒ 0).
- **`index.test.ts`** (`WalletService` reativo): `init` carrega; `earn`/`spend` mutam o sinal
  e persistem; `spend` insuficiente devolve false e não persiste débito.
- **`match.test.ts`** (já existe): novo teste de que `onGameOver` dispara **1×** na transição
  para `dead` (não em `ready`/`playing`, não repetido em frames seguintes) com o `world` morto.
- **Nest**: teste de que `buy` com saldo suficiente debita a carteira e credita o dino; saldo
  insuficiente não faz nenhum dos dois. (`store.ts` puro do nest permanece; só o serviço muda.)
- **Shop**: `packs.ts` puro (catálogo válido, ids únicos, coins > 0). UI: smoke leve se
  couber no padrão happy-dom (menos cerimônia p/ cosmético).
- **Determinismo**: `verify-determinism` verde (67), inalterado.

## Riscos / notas

- **Gotcha signals+happy-dom** (recorrente 4.1–4.4): em teste de componente, após evento DOM
  usar `await Promise.resolve()`; `useEffect` precisa de macrotask. Testes de serviço (sinais
  puros) não sofrem disso.
- `getHomeStats` deixa de ser "puro sem dependências" (passa a ler um sinal) — aceitável, é o
  ponto de religação previsto no próprio seam; assinatura preservada.
- Ordem de wiring no `main.tsx`: `walletService.init()` **antes** de qualquer render que leia
  saldo (como os demais serviços).

## Definição de pronto

- Carteira persiste entre reloads; comida vira moedas no Game Over; comprar dino debita e
  funciona; Loja credita pacotes; Home mostra saldo real. `npm run check` limpo, `npm test`
  verde, determinismo 67 intacto. Item 4.5 marcado `[x]`; "Estado atual" do CLAUDE.md atualizado.
