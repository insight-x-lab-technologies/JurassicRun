# 6.3 — Leaderboard central (Supabase, offline-first)

> Fase 6 (Online). Spec da feature. Modo autônomo: decisões tomadas pela recomendação,
> sem gate humano. `src/core/` **não é tocado** ⇒ determinismo 67 inalterado.

## Objetivo

Submeter e ler rankings **globais** Endless/Diário/Semanal via Supabase, mantendo o
leaderboard **local** como fallback quando offline. Degrada graciosamente: sem `.env`
(ou falha de sign-in) o jogo se comporta exatamente como hoje (100% local).

## Contexto existente (reuso)

- `src/services/leaderboard/` — serviço reativo **local** (store puro + storage localStorage
  + `LeaderboardService` com sinais `endless/daily/weekly/bestEndlessLevel`, `recordMatch`,
  `dailyRankForSeed`). Ranking por `score` desc; Endless top-10, Diário/Semanal dedup por seed.
- `src/services/online/` — infra online (Fase 6.2): `OnlineClient` (seam de IO com
  `memoryOnlineClient` spy + `createSupabaseClient` real embrulhando `@supabase/supabase-js`
  com a sessão anônima), `OnlineService` reativo (`globalPlayerId`, `status`
  `offline|connecting|online|error`, offline-first, nunca lança). `schema.ts` já define
  `ONLINE_MODES`, `TABLES.scores` e as colunas de `scores`.
- Tabela `scores` (6.1): `player_id, mode, seed, score, distance, food, near_misses, level,
  verified, created_at`. RLS: SELECT público; INSERT só da própria linha (`player_id =
  auth.uid()`); imutável (sem update/delete). Trigger `lock_verified` força `verified=false`
  no cliente (seam anti-cheat 6.4 — não bloqueia exibição).
- `src/app/screens/LeaderboardScreen.tsx` — 3 abas, lista rankeada com medalhas 🥇🥈🥉.
- `@render/seedSource`: `dailyChallengeSeed()` / `weeklyChallengeSeed()` (seed do período atual).

## Arquitetura

Padrão do projeto: **puro × casca** + **seam de IO** + reatividade `@preact/signals`.
`LeaderboardService` fica online-aware **sem** importar `OnlineService` nem a camada render:
depende só de uma interface injetável `LeaderboardOnline` (memória nos testes, adapter real
no `app/`). Assim a lógica de merge/mapeamento é pura/testável e a única IO fica na casca.

### 1. Seam de IO — extensão de `OnlineClient` (`online/client.ts`)

Reusa a **mesma** instância supabase (mesma sessão anônima) que já faz `upsertPlayer`.

```ts
type OnlineMode = (typeof ONLINE_MODES)[number]; // 'endless' | 'daily' | 'weekly'

interface OnlineScoreInput {                      // payload de submit (playerId anexado pela casca)
  readonly playerId: string; readonly mode: OnlineMode; readonly seed: string;
  readonly score: number; readonly distance: number; readonly food: number;
  readonly nearMisses: number; readonly level: number;
}
interface OnlineScoreRow extends OnlineScoreInput { // linha lida (+ identidade do jogador)
  readonly playerName: string; readonly playerAvatar: string; readonly createdAt: number;
}

interface OnlineClient {                            // ...métodos existentes +
  submitScore(input: OnlineScoreInput): Promise<void>;
  fetchScores(mode: OnlineMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
}
```

- `memoryOnlineClient` (spy): grava submits em `submittedScores`; `fetchScores` devolve
  linhas configuráveis (`opts.scores`) filtradas por `mode`/`seed`. Sem rede.
- `createSupabaseClient` (casca real, não testada por unidade):
  - `submitScore`: `insert` em `TABLES.scores` (`verified` omitido ⇒ trigger o força false).
  - `fetchScores`: `select('*, players(name, avatar)')` de `scores`, `eq('mode', …)`,
    `seed` opcional (`eq('seed', …)`), `order('score', {ascending:false})`, `limit`
    generoso (ex.: `MAX_ENTRIES × 8` p/ permitir dedup por jogador no cliente). Mapeia a
    linha bruta → `OnlineScoreRow` (nome/avatar do join; ausentes ⇒ placeholders vazios).

> `OnlineMode`/tipos de score vivem na camada online (usa `ONLINE_MODES` de `schema.ts`),
> sem importar `leaderboard` (infra não depende de feature).

### 2. `OnlineService` — sinal `online` + delegadores guardados (`online/index.ts`)

```ts
readonly online: ReadonlySignal<boolean>;          // = status.value === 'online'
submitScore(input: Omit<OnlineScoreInput,'playerId'>): Promise<void>; // anexa globalPlayerId; no-op se offline/sem id
fetchScores(mode, seed?): Promise<readonly OnlineScoreRow[]>;         // [] se offline
```

Ambos best-effort: engolem erro de rede sem derrubar `status`. Guardam em `online===false`
ou `globalPlayerId===null`.

### 3. Mapeamento puro (`leaderboard/central.ts`)

```ts
interface CentralEntry {                            // = entrada exibível do board global
  readonly playerId: string; readonly playerName: string; readonly playerAvatar: string;
  readonly seed: string; readonly score: number; readonly distance: number;
  readonly food: number; readonly nearMisses: number; readonly createdAt: number;
}
function toCentralEntries(rows: readonly OnlineScoreRow[], maxEntries = MAX_ENTRIES): readonly CentralEntry[];
```

Puro: **dedup por `playerId`** (mantém o melhor score de cada jogador), ordena por `score`
desc (desempate `createdAt` asc, depois `playerId`), corta top-`maxEntries`, sanea números
(`sanitizeStat`). Unit-testado (dedup, ordem, corte, saneamento).

### 4. Interface injetável `LeaderboardOnline` (`leaderboard/online.ts`)

```ts
interface LeaderboardOnline {
  readonly online: ReadonlySignal<boolean>;
  submitScore(input: LeaderboardResult): Promise<void>;
  fetchScores(mode: LeaderboardMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
  currentSeeds(): { readonly daily: string; readonly weekly: string };
}
```

+ `memoryLeaderboardOnline(opts)` p/ testes (sinal `online` fixável, grava submits, devolve
rows configuráveis, seeds fixas).

### 5. `LeaderboardService` online-aware (`leaderboard/index.ts`)

- Novos sinais: `centralEndless / centralDaily / centralWeekly:
  ReadonlySignal<readonly CentralEntry[]>` (inicial `[]`) e `centralAvailable:
  ReadonlySignal<boolean>` (= `online` do adapter, ou `false` se sem adapter).
- `init(storage?, online?: LeaderboardOnline)`: se `online` presente, monta um `effect` que,
  quando `online.online` vira `true`, dispara `refreshCentral()` (fetch das 3 abas: endless
  sem seed; daily/weekly com `online.currentSeeds()`), aplicando `toCentralEntries` a cada.
  Reentrante (descarta effect anterior, molde `OnlineService`/`AudioService`).
- `recordMatch(r)`: comportamento local **inalterado** + `void online?.submitScore(r)` (fire-
  and-forget) seguido de refetch **daquela** aba (best-effort). Offline ⇒ só local.
- Guardas: sem adapter ⇒ tudo como hoje; central signals ficam `[]`, `centralAvailable=false`.

### 6. Adapter real (`src/app/online/leaderboardAdapter.ts`) + fiação

Casca app (cross-layer permitido): `createLeaderboardOnline()` implementa `LeaderboardOnline`
sobre `onlineService` (online/submitScore/fetchScores) + `seedSource`
(`dailyChallengeSeed`/`weeklyChallengeSeed`). `main.tsx`:
`leaderboardService.init(undefined, createLeaderboardOnline())`.

### 7. `LeaderboardScreen`

- Por aba: se `centralAvailable` ⇒ mostra `central*` (nome do jogador + destaque "você" via
  `globalPlayerId`? — ver YAGNI); senão mostra o local atual. Indicador de fonte
  **Global/Local** (chave i18n). Reusa medalhas/estrutura; nova linha exibe `playerName`.
- Estado vazio central: se online mas board vazio ⇒ mensagem "seja o primeiro" (reusa/1 chave).
- i18n: `leaderboard.source.global`, `leaderboard.source.local`, `leaderboard.player`
  (rótulo do nome), nos 10 locales.

## Fluxo de dados

```
Game Over → LeaderboardService.recordMatch(r)
              ├─ local: store + localStorage (como hoje)
              └─ online?.submitScore(r)  → OnlineService → OnlineClient.submitScore (insert scores)
                                          → refetch(mode) → toCentralEntries → central signal
Abrir tela / online vira true → refreshCentral() → fetchScores(3 modos) → central signals
Offline → nenhum submit/fetch; tela usa boards locais
```

## Escopo / YAGNI (cortes deliberados)

- **Sem realtime/subscriptions, sem paginação, sem histórico** de dias/semanas: Diário/Semanal
  central mostram **só o período atual** (seed de hoje / semana ISO corrente) — é a competição
  natural do modo. Endless central = top-N global de todos os tempos.
- **Sem merge local+central**: a tela alterna a fonte pelo status online (não funde listas).
- **`verified` não exibido** (6.4 adiciona o selo ✓ após a Edge Function).
- **Destaque "você"** na lista central: incluído se barato (compara `playerId` com
  `globalPlayerId`); senão adiado — não é bloqueador do DoD.
- Identidade **global** (não por-perfil) — como todo o resto da Fase 6.
- Top-N central = `MAX_ENTRIES` (10), reusado.

## Testes

- Puro `toCentralEntries`: dedup por jogador, ordenação/desempate, corte top-N, saneamento.
- `memoryOnlineClient` estendido: `submitScore` grava; `fetchScores` filtra por mode/seed.
- `LeaderboardService` com `memoryLeaderboardOnline`: (a) online ⇒ `recordMatch` submete +
  popula central; (b) online-flip ⇒ `refreshCentral` popula as 3 abas; (c) offline ⇒ zero
  submit, central `[]`, local intacto; (d) sem adapter ⇒ comportamento idêntico ao atual.
- i18n: paridade dos 10 locales + scanner AST (sem string hardcoded).
- `src/core/` intocado ⇒ bateria de determinismo (67) inalterada (rodar p/ evidência).

## Definição de pronto (item)

Rankings centrais submetidos e lidos nas 3 abas; offline degrada para local sem exceção;
`check` + `test` + `test:determinism` verdes; item 6.3 marcado; "Estado atual" atualizado.

## Pré-requisito do usuário (herdado 6.1/6.2)

Migração aplicada + `jurassicrun` em _Exposed schemas_ + _Anonymous sign-ins_ + `.env`
preenchido. Sem isso, 6.3 roda **offline** (correto): boards locais, nenhum erro.
