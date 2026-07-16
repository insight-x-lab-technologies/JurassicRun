# 6.5 — Troféus centrais (sincronizados) + pódio diário global

> Fase 6 (Online — Supabase), item 6.5. Spec de feature. Modo autônomo.

## Objetivo

Roadmap: **"Top-3 do desafio diário recebem troféu no perfil (sincronizado)."**

Dois entregáveis, ambos **só na camada de serviços/app** — `src/core/` **intocado** ⇒
determinismo **67 inalterado** (sem re-pin de goldens):

1. **Sync de troféus ao servidor** — a tabela `jurassicrun.trophies` já existe (6.1) mas
   nenhum código escreve nela. Troféus desbloqueados localmente passam a ser **sincronizados**
   ao perfil online (o `players.id = auth.uid()` de 6.2): push ao desbloquear + **merge**
   (união) na borda offline→online. Isso realiza "no perfil (sincronizado)" e dá backup
   cross-device (mesma identidade anônima).

2. **Endurecer `dailyPodium` para top-3 CENTRAL quando online** — 5.3 desbloqueia o troféu no
   top-3 do leaderboard **local** e deixou explícito "endurecimento p/ top-3 global (Fase 6)".
   Online: o rank vem do **leaderboard central** (ranking global do dia). Offline: mantém o
   rank local (fallback leniente).

## Não-objetivos (YAGNI / adiados)

- Troféus **por-perfil** (hoje globais como wallet/trophy/nest — a Fase 6 unifica na identidade
  online; multi-perfil-online fica fora).
- Pódio **semanal** análogo (só diário, como 5.3).
- Toast de "conquista desbloqueada" (seam `newlyUnlocked` já existe; UI fica p/ Fase 8).
- Mudança de schema/DDL (a tabela `trophies` já foi criada e tem RLS em 6.1).
- Verificação anti-cheat do troféu de pódio (o pódio usa o `scores` central, não-verificado
  nesta fase — mesma decisão "sinal, não gate" do 6.4).

## Arquitetura

Segue o **molde exato do leaderboard online (6.3)**: interface injetável + adapter, para que
`TrophyService` **não importe** `OnlineService` (fronteira limpa, testável com um double de
memória). Tudo **best-effort / offline-first**: sem `.env` ou offline ⇒ jogo 100% local, sem
exceção propagada.

### Peça 1 — seam de IO (`OnlineClient` + `OnlineService`)

`src/services/online/client.ts` — `OnlineClient` ganha:
- `submitTrophies(playerId: string, ids: readonly string[]): Promise<void>` — upsert de linhas
  `{player_id, trophy_id}`. **`ignoreDuplicates: true`** (`onConflict: 'player_id,trophy_id'`):
  a RLS de `trophies` (6.1) só tem `select_public` + `insert_own`, **sem policy de UPDATE** ⇒ o
  upsert precisa ser insert-only para não bater em deny-by-default numa reinserção.
- `fetchTrophies(playerId: string): Promise<readonly string[]>` — `select trophy_id where
  player_id = playerId` (SELECT é público via RLS).

`memoryOnlineClient` ganha `submittedTrophies: string[]` e `fetchTrophies` devolve
`opts.trophies ?? []`.

`src/services/online/index.ts` — `OnlineService` ganha delegadores best-effort (guardam
`online` + `id`, anexam o próprio `globalPlayerId = auth.uid()`, nunca lançam):
- `submitTrophies(ids: readonly string[]): Promise<void>`
- `fetchTrophies(): Promise<readonly string[]>`

### Peça 2 — troféu online-aware (`TrophyOnline` + adapter)

`src/services/trophy/online.ts` (novo, molde de `leaderboard/online.ts`):
```ts
export interface TrophyOnline {
  readonly online: ReadonlySignal<boolean>;
  submitTrophies(ids: readonly string[]): Promise<void>;
  fetchTrophies(): Promise<readonly string[]>;
}
```
+ `memoryTrophyOnline({online?, trophies?})` (double: `submitted: string[]`, `setOnline(v)`).

`src/app/online/trophyAdapter.ts` (novo, molde de `leaderboardAdapter.ts`):
`createTrophyOnline({onlineSvc?})` liga `online`/`submitTrophies`/`fetchTrophies` ao
`onlineService`.

`src/services/trophy/index.ts` — `TrophyService`:
- `init(storage?, online?)` — guarda o seam; monta um `effect` na borda **offline→online**
  (guarda `lastOnline`, reentrante, molde do `LeaderboardService`) que dispara
  `void mergeFromServer().catch(()=>{})`.
- `recordMatch(...)` — inalterado no cálculo local; **após** o commit, `pushToServer(newlyUnlocked)`.
- **novo** `recordDailyPodium(dailyRank: number): readonly string[]` — reavalia com
  `TrophyEvalContext {stats: state.stats, dailyRank}` (reusa a função pura `evaluate`); só
  `dailyPodium` pode destravar por `dailyRank` (os demais dependem de `stats`, já avaliados e
  inalterados). Commit + `pushToServer` se algo destravou.
- `private pushToServer(ids)` — `if (ids.length && online?.online.value) void
  online.submitTrophies(ids).catch(()=>{})`.
- `private async mergeFromServer()` — reconciliação **bidirecional**:
  ```
  server = (await online.fetchTrophies()).filter(isKnownTrophyId)
  local  = state.unlocked
  union  = dedup(local ∪ server)
  if (union.length > local.length) commit(unlocked = union)   // servidor tinha extras
  localOnly = local.filter(id => !server.includes(id))
  if (localOnly.length) void online.submitTrophies(localOnly)  // ganhos offline sobem
  ```
  (`isKnownTrophyId` = `trophyById(id) !== undefined`, filtra ids desconhecidos/velhos.)

### Peça 3 — rank central do pódio (`LeaderboardService`)

O rank central é **assíncrono** (ida à rede) e o `LeaderboardService.recordMatch` submete o
score **fire-and-forget**. Para eliminar a corrida (e dar rank correto na 1ª jogada do dia),
o cálculo do rank **injeta o meu score recém-jogado** nas linhas do servidor antes de ranquear.

`src/services/leaderboard/online.ts` — `LeaderboardOnline` ganha
`readonly playerId: ReadonlySignal<string | null>` (adapter liga a
`onlineService.globalPlayerId`; `memoryLeaderboardOnline` aceita `playerId?`).

`src/services/leaderboard/index.ts` — novo:
```ts
async centralDailyRank(result: LeaderboardResult): Promise<number | undefined>
```
- offline / `playerId === null` / `result.mode !== 'daily'` ⇒ `undefined`.
- `rows = await fetchScores('daily', result.seed)`; monta uma `OnlineScoreRow` sintética do
  meu `result` (com o meu `playerId`); `entries = toCentralEntries([...rows, synthetic])`
  (dedup por jogador mantém o melhor score ⇒ robusto à corrida); `idx = indexOf(meu playerId)`;
  devolve `idx >= 0 ? idx + 1 : undefined` (rank real; a decisão ≤3 é do troféu).

### Peça 4 — fiação (`startGame.onGameOver`, `main.tsx`)

`src/app/game/startGame.ts` — reescreve a seção de troféu/pódio:
```ts
leaderboardService.recordMatch(result);              // submit + refresh central (async interno)
const online = leaderboardService.centralAvailable.value;
const localRank = mode === 'daily' && !online
  ? leaderboardService.dailyRankForSeed(match.seedLabel) : undefined;
trophyService.recordMatch(summary, localRank !== undefined ? { dailyRank: localRank } : undefined);
if (mode === 'daily' && online) {
  void leaderboardService.centralDailyRank(result)
    .then((rank) => { if (rank !== undefined) trophyService.recordDailyPodium(rank); })
    .catch(() => {});
}
```
Semântica: **online ⇒ só o rank central pode destravar o pódio** (`localRank` fica `undefined`,
o troféu não destrava leniente); **offline ⇒ rank local** (fallback). O troféu é monotônico
(uma vez ganho, permanece) e a avaliação é idempotente. `recordMatch` sobe os ganhos gerais;
o pódio central sobe o dele; e o `mergeFromServer` na próxima conexão reconcilia o que faltou.

`src/app/main.tsx` — `trophyService.init(undefined, createTrophyOnline());` (após
`onlineService.init()`, molde do `leaderboardService.init(...)`).

### Peça 5 — i18n

`dailyPodium.desc` hoje diz "**local** Daily Challenge". Como online passa a ranquear no board
global, atualiza-se a descrição nos **10 locales** (REGRA 4, skill `add-locale`) para remover
"local" (ex.: "Finish top 3 on the Daily Challenge."). Sem chaves novas.

## Offline-first (comportamento sem `.env`)

- `onlineService` em `offline` ⇒ `TrophyOnline.online = false` ⇒ `pushToServer`/`mergeFromServer`
  são no-op; `centralAvailable = false` ⇒ pódio usa rank **local** (comportamento idêntico ao 5.3).
- Nenhuma exceção propaga do caminho best-effort. Jogo 100% igual ao anterior.

## Determinismo

Nada em `src/core/`. Reusa `toCentralEntries` (puro, 6.3) e `evaluate` (puro, 4.7). Determinismo
**67 inalterado**. `verify-determinism` só confirma que o core não foi tocado.

## Plano de testes

Unitários (puros/serviços, molde da suíte existente):
- `trophy/online.ts` — `memoryTrophyOnline` double.
- `TrophyService` — `recordMatch` faz push quando online / no-op offline; `recordDailyPodium`
  destrava `dailyPodium` em rank ≤ 3 e **não** em rank > 3; `mergeFromServer` faz união dos ids
  do servidor + push dos locais-só; ids desconhecidos filtrados.
- `OnlineService` — `submitTrophies`/`fetchTrophies` guardam offline, anexam o próprio id.
- `memoryOnlineClient` — `submittedTrophies`/`fetchTrophies`.
- `LeaderboardService.centralDailyRank` — injeta o sintético e computa o rank; `undefined`
  offline / sem id / fora do board; corrida coberta (server sem meu score ⇒ ainda ranqueia).
- i18n — paridade + scanner AST verdes após o ajuste da descrição.

Integração (`onGameOver`) é casca fina — coberta indiretamente (precedente 4.5/5.3).

## Consequência de produto

- **`dailyPodium` online = top-3 global** (estrito, significativo); **offline = top-3 local**
  (leniente, jogável sem rede). Documentado; é a dupla-natureza offline-first, não bug.
- Troféus viram **sincronizados** ao perfil online (backup + cross-device na mesma identidade
  anônima). Continuam **globais** por dispositivo (por-perfil = fora de escopo).
</content>
</invoke>
