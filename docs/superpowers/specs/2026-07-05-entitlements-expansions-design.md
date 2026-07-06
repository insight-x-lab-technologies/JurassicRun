# 4.6 — Entitlements + Expansões — Design

> Spec do item 4.6 do `docs/roadmap/PHASE-04-meta-offline.md`.
> Data: 2026-07-05. Modo autônomo (SDD). Referência: ADR-0004 (monetização/entitlements),
> ADR-0003 (expansões puramente cosméticas).

## Objetivo

Fechar as pendências que 4.3/4.5 empurraram para cá:

1. **`EntitlementsService`** — serviço global reativo+persistido que rastreia o que o jogador
   **desbloqueou** (expansões premium) e qual expansão está **ativa**. Honor-system agora, com
   um **provider plugável** para um gateway real depois (ADR-0004), sem refatorar consumidores.
2. **Tela de Expansões** (`expansions`) — catálogo de expansões **cosméticas**; selecionar a
   ativa; desbloquear as premium por honor-system.
3. **Doação** — o botão do Home deixa de ser stub desabilitado e passa a abrir a URL de doação
   (Ko-Fi/BuyMeACoffee), fechando a pendência anotada em 4.3.

## Escopo — o que NÃO entra (decisões de produto)

- **Efeito visual da expansão ativa = Fase 8.** Em 4.6 construímos o **sistema** (catálogo +
  seleção ativa persistida + o **seam** `activeExpansion` que o render consumirá), exatamente
  como o Ninho (4.4) construiu os traços antes da arte real e como os traços têm cosmético
  adiado. As expansões são placeholders (id + nome + i18n); a arte/atlas real (packs look&feel)
  é a Fase 8. Nenhuma expansão altera gameplay/determinismo (ADR-0003).
- **Gateway de pagamento real.** Desbloqueio é **honor-system** (concede na hora, sem cobrança),
  igual aos coin packs da Loja (4.5). O `EntitlementProvider` é a abstração que a Fase 8 troca
  por um provider de gateway (Ko-Fi shop / Stripe + validação por Edge Function) — ADR-0004.
- **Expansões NÃO custam moedas.** Moedas (comida) compram dinos no Ninho; expansões premium
  são desbloqueadas por doação/honor-system. Separação de ADR-0004 ("packs desbloqueados por
  código de doação (honor-system)"). Não há campo de "código" real (sem backend p/ validar): o
  honor-system concede direto, e o `EntitlementProvider` é onde um provider futuro validaria um
  código/recibo.
- **Entitlements por-perfil.** Como carteira e Ninho, os entitlements são **globais**
  (compartilhados entre perfis). Por-perfil/sync entra na Fase 6.
- **`getHomeStats` (troféus / nível máx)** continua placeholder (4.7 / Fase 5); 4.6 não toca.

## Determinismo

**`src/core/` NÃO é tocado.** Entitlements/expansões vivem 100% na camada de serviços/UI (meta
offline), fora da simulação. Expansões são cosméticas por contrato (ADR-0003) — não entram no
`WorldState`, nem no `hashState`, nem em qualquer stream de RNG. Determinismo permanece intacto
(67 testes); rodaremos `verify-determinism` como **prova**, não porque há risco.

## Arquitetura

Novo serviço `src/services/entitlements/`, no padrão **puro × casca** já usado em
`services/wallet/` e `services/nest/`.

### `catalog.ts` (PURO — sem IO)

```ts
export type ExpansionTier = 'free' | 'premium';

export interface ExpansionDef {
  readonly id: string;         // ex.: 'classic', 'volcano', 'glacier'
  readonly tier: ExpansionTier;
  readonly nameKey: string;    // chave i18n do nome  ('expansion.<id>.name')
  readonly descKey: string;    // chave i18n da descrição ('expansion.<id>.desc')
  readonly hue: number;        // cor placeholder p/ o card (como DinoDef.hue), até a arte da Fase 8
}

export const DEFAULT_EXPANSION_ID = 'classic';
export const EXPANSION_CATALOG: readonly ExpansionDef[];   // classic (free) + volcano/glacier (premium, placeholders)
export function expansionById(id: string): ExpansionDef | undefined;
```

- `classic` é `free` e nasce **desbloqueada + ativa** (o look atual do jogo). `volcano`/`glacier`
  são `premium` placeholders (tuning/arte na Fase 8). Preços/valores não existem — desbloqueio é
  honor-system, não compra por moeda.

### `provider.ts` (o seam de ADR-0004)

```ts
export type UnlockOutcome = 'granted' | 'declined';

export interface EntitlementProvider {
  /** Solicita o desbloqueio de uma expansão. v1 honor-system concede sempre. */
  requestUnlock(id: string): UnlockOutcome;
}

/** Provider v1: honor-system — concede na hora, sem cobrança. */
export const honorSystemProvider: EntitlementProvider;
```

- **Síncrono** agora (como `walletService.spend`), matching o resto do codebase. Um gateway real
  (assíncrono, validação de recibo) troca a implementação do provider + a única call-site em
  `EntitlementsService.unlock`; consumidores (a tela) não mudam. Documentado como o ponto de
  extensão da Fase 8.

### `store.ts` (PURO — sem IO, sem aleatoriedade, sem `Date`)

```ts
export interface EntitlementsState {
  readonly unlocked: readonly string[];   // ids desbloqueados (sempre inclui DEFAULT)
  readonly activeId: string;              // expansão ativa (sempre um id desbloqueado)
}

export type UnlockResult = 'ok' | 'alreadyUnlocked' | 'unknown';

export function initialEntitlementsState(): EntitlementsState;   // { unlocked:[classic], activeId:classic }
export function isUnlocked(state: EntitlementsState, id: string): boolean;
export function unlock(state: EntitlementsState, id: string):
  { state: EntitlementsState; result: UnlockResult };           // adiciona ao unlocked (imutável)
export function setActive(state: EntitlementsState, id: string): EntitlementsState;  // guard: só se unlocked
```

- `unlock` valida contra o catálogo (`unknown` se o id não existe), é idempotente
  (`alreadyUnlocked` se já tem), imutável. **Não** ativa automaticamente — desbloquear e ativar
  são ações separadas (como comprar × selecionar no Ninho).
- `setActive` só troca se o id estiver desbloqueado (senão no-op), espelhando `nest/store.setActive`.

### `storage.ts` (casca IO injetável — molde de `nest/storage.ts`)

```ts
export interface EntitlementsStorage { load(): EntitlementsState; save(s: EntitlementsState): void; }
export const STORAGE_KEY = 'jurassicrun.entitlements.v1';
export function memoryEntitlementsStorage(initial?): EntitlementsStorage;   // testes + fallback
export function localStorageEntitlementsStorage(): EntitlementsStorage;
```

- `sanitize`/`parseState` robusto (molde de `nest`): filtra ids desconhecidos; `DEFAULT` sempre
  presente em `unlocked`; `activeId` resolve p/ um desbloqueado (senão `DEFAULT`). Qualquer JSON/
  forma inválida ⇒ `initialEntitlementsState()`. `save` best-effort (engole storage indisponível).

### `index.ts` (`EntitlementsService` reativo — singleton, molde de `nestService`)

```ts
class EntitlementsService {
  readonly unlockedIds: ReadonlySignal<readonly string[]>;
  readonly activeExpansion: ReadonlySignal<ExpansionDef>;   // o SEAM da Fase 8 (render lê isto)
  init(storage?: EntitlementsStorage, provider?: EntitlementProvider): void;   // defaults reais
  unlock(id: string): UnlockResult;   // provider.requestUnlock; se 'granted' → store.unlock + commit
  select(id: string): void;           // store.setActive + commit
}
export const entitlementsService = new EntitlementsService();
```

- `commit(state)` = set-sinal + `storage.save` (idêntico ao padrão dos outros serviços).
- `unlock(id)`: chama `provider.requestUnlock(id)`; só em `'granted'` aplica `store.unlock` e
  persiste; devolve o `UnlockResult` (ou `'unknown'` se o provider declinou / id inválido) p/ a UI.
- `activeExpansion` resolve `expansionById(activeId) ?? expansionById(DEFAULT)!` (como
  `nestService.activeDino`), garantindo sempre um `ExpansionDef` válido.
- `main.tsx` chama `entitlementsService.init()` no bootstrap (ao lado dos outros `init()`).

## Tela de Expansões (`ExpansionsScreen.tsx`)

- Rota `expansions` deixa de ser `PlaceholderScreen` e passa a renderizar `ExpansionsScreen`
  (troca no `App.tsx`/`screenFor`).
- Grid de cards (molde de `NestScreen`), um por `EXPANSION_CATALOG`:
  - avatar/placeholder colorido (`hue`) — arte real Fase 8;
  - nome (`expansion.<id>.name`) + descrição (`expansion.<id>.desc`);
  - se **ativa**: selo `expansions.active`;
  - senão se **desbloqueada**: botão `expansions.select` → `entitlementsService.select(id)`;
  - senão (**premium bloqueada**): botão `expansions.unlock` → `entitlementsService.unlock(id)`
    (honor-system, desbloqueia na hora; o card re-renderiza reativo p/ o estado "select").
- Nota i18n `expansions.honorNote` (honor-system, sem cobrança) + nudge de doação. Botão **Voltar**.

## Doação (Home)

- `src/app/home/donate.ts` (molde fino de `home/share.ts`, injetável p/ teste):

```ts
export const DONATE_URL = 'https://ko-fi.com/jurassicrun';   // PLACEHOLDER — trocar pelo handle real
export interface DonateDeps { openUrl?: (url: string) => void; }
export function openDonation(deps?: DonateDeps): void;        // best-effort window.open(_blank,noopener)
export function defaultDonateDeps(): DonateDeps;              // casca: window.open real
```

- `HomeScreen`: o botão `home-donate` deixa de ser `disabled`; `onClick={() =>
  openDonation(defaultDonateDeps())}`. `openDonation` engole erro (best-effort, como `shareGame`).
- **`DONATE_URL` é placeholder** — anotado no código e no relatório p/ o usuário preencher o
  handle Ko-Fi/BMC real. Não bloqueia (o deploy é a Fase 7).

## i18n (REGRA 4 — 10 locales, via skill `add-locale`)

Chaves novas (paridade garantida pelo teste de locales):

- `expansions.title`, `expansions.active`, `expansions.select`, `expansions.unlock`,
  `expansions.honorNote`, `expansions.back`. (Três estados de card: ativa → selo `active`;
  desbloqueada → botão `select`; premium bloqueada → botão `unlock`. Sem quarto rótulo.)
- `expansion.classic.{name,desc}`, `expansion.volcano.{name,desc}`, `expansion.glacier.{name,desc}`.

`nav.donate` e `screen.expansions` já existem. Nenhuma string visível hardcoded. `screen.comingSoon`
do stub de doação deixa de ser usado ali (permanece para outros stubs).

## Testes

- **`catalog.test.ts`** (puro): catálogo válido (ids únicos, `classic` presente/`free`, demais
  `premium`); `expansionById` (hit/miss); `DEFAULT_EXPANSION_ID` existe no catálogo.
- **`store.test.ts`** (puro): `initialEntitlementsState` (classic unlocked+active); `isUnlocked`;
  `unlock` (adiciona, idempotente `alreadyUnlocked`, `unknown` p/ id fora do catálogo, imutável,
  não ativa); `setActive` (troca se unlocked, no-op se não).
- **`provider.test.ts`**: `honorSystemProvider.requestUnlock` devolve `'granted'` (qualquer id —
  a validação de existência é do store).
- **`storage.test.ts`**: round-trip memory + localStorage (mock); `parseState` robusto (JSON
  inválido, forma errada, ids desconhecidos filtrados, `DEFAULT` sempre presente, `activeId`
  não-desbloqueado ⇒ DEFAULT).
- **`index.test.ts`** (`EntitlementsService` reativo): `init` carrega; `unlock` concede via
  provider e muta o sinal + persiste; `unlock` com provider que declina não muta; `select` de id
  desbloqueado muda `activeExpansion` e persiste; `select` de id não desbloqueado é no-op.
- **`donate.test.ts`** (puro/injetável): `openDonation` chama `openUrl` com `DONATE_URL`; erro em
  `openUrl` é engolido (não propaga).
- **UI**: `ExpansionsScreen` — smoke leve no padrão happy-dom se couber (menos cerimônia p/
  cosmético; a lógica real está nos serviços puros). Gotcha signals+happy-dom conhecido.
- **Determinismo**: `verify-determinism` verde (67), inalterado.

## Riscos / notas

- **Gotcha signals+happy-dom** (recorrente 4.1–4.5): em teste de componente, após evento DOM usar
  `await Promise.resolve()`; `useEffect` precisa de macrotask. Testes de serviço (sinais puros)
  não sofrem disso.
- **`DONATE_URL` placeholder** — precisa do handle real antes do deploy (Fase 7); sinalizado.
- **Provider síncrono** hoje; um gateway assíncrono na Fase 8 troca o provider e o único
  call-site (`unlock`), não a tela. Documentado.
- Ordem de wiring no `main.tsx`: `entitlementsService.init()` no bootstrap, antes do primeiro
  render que leia expansões (como os demais serviços).

## Definição de pronto

- `EntitlementsService` persiste entre reloads; tela de Expansões lista/desbloqueia (honor-system)/
  seleciona a ativa; `activeExpansion` exposto como seam p/ Fase 8; botão de doação abre a URL.
  `npm run check` limpo, `npm test` verde, determinismo 67 intacto. Item 4.6 marcado `[x]`;
  "Estado atual" do CLAUDE.md atualizado; ADR-0004 permanece a referência (sem novo ADR).
```

