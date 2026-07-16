# Fase 6 — Online (Supabase)

**Objetivo:** recursos online atrás das interfaces já existentes dos services. Requer conta
Supabase (free tier) criada pelo usuário.

## Pré-requisito do usuário
- [ ] Criar projeto Supabase; fornecer URL + anon key (via `.env`, nunca commitado).

## Itens

### 6.1 Schema — CONCLUÍDO
- [x] Tabelas: `players` (id global único, nome, avatar, criado_em), `scores`
      (player_id, modo, seed, score, distância, criado_em), `challenge_entries`,
      `trophies`. RLS adequada.
      Entregue: schema Postgres dedicado `jurassicrun` (isolamento no banco compartilhado
      `InsightXLabGamesHub` — supera prefixo `jr_`); identidade via Supabase Auth anônimo
      (`players.id = auth.uid()`); RLS por linha (SELECT público, escrita só do dono);
      flag `verified` travada ao `service_role` via trigger `lock_verified` (seam do
      anti-cheat 6.4). Migração idempotente `supabase/migrations/20260708000000_jr_schema.sql`
      + constantes `src/services/online/schema.ts` + guarda de contrato SQL×TS + `.env.example`
      + `supabase/README.md`. **Pré-req do usuário p/ 6.2+:** aplicar a migração + habilitar
      `jurassicrun` em _Exposed schemas_ e _Anonymous sign-ins_ no dashboard.

### 6.2 ID global de jogador — CONCLUÍDO
- [x] Registrar jogador no servidor e obter ID único mundial; vincular ao perfil local.
      Entregue: identidade global via Supabase Auth anônimo (`players.id = auth.uid()`),
      vinculada ao perfil local ativo (nome/avatar via upsert). Padrão puro×casca em
      `src/services/online/`: `config.ts` (`parseOnlineConfig`/`onlineConfig` — sem env ⇒
      `null` ⇒ modo offline), `client.ts` (interface `OnlineClient` + `memoryOnlineClient`
      spy + casca real `createSupabaseClient` reusando a sessão anônima persistida),
      `index.ts` (`OnlineService` reativo: sinais `globalPlayerId`/`status`
      `offline|connecting|online|error`, `init` async não-bloqueante, sync do perfil ativo
      com dedup por assinatura, effect reentrante). Offline-first: sem `.env` ou falha de
      sign-in ⇒ jogo 100% local, sem exceção propagada. UI read-only de status na
      `ProfileScreen`; fiação fire-and-forget no `main.tsx`; i18n `online.*` nos 10 locales.
      `src/core/` intocado ⇒ determinismo **67 inalterado**.

### 6.3 Leaderboard central — CONCLUÍDO
- [x] Submeter e ler rankings Endless/Diário/Semanal. `LeaderboardService` passa a usar
      Supabase mantendo fallback local/offline.
      Entregue: seam `OnlineClient` estendido (`submitScore`/`fetchScores`, mesma sessão
      anônima) + `OnlineService` com sinal `online` e delegadores best-effort (nunca lançam);
      `LeaderboardService` online-aware via interface injetável `LeaderboardOnline` (memória
      nos testes, adapter `src/app/online/leaderboardAdapter.ts` no bootstrap) — sinais
      `centralEndless/Daily/Weekly` + `centralAvailable`, submit fire-and-forget no `recordMatch`,
      refresh na borda offline→online; mapeamento puro `toCentralEntries` (dedup por jogador,
      top-10). Diário/Semanal central = período atual (mesma seed do submit). Tela alterna
      Global/Local pelo status, com nome do jogador e destaque "você" (`globalPlayerId`); i18n
      `leaderboard.source.{global,local}` + `leaderboard.player` nos 10 locales. Offline-first:
      sem `.env`/offline degrada 100% ao local, sem exceção. `src/core/` intocado ⇒ determinismo
      **67 inalterado**; suíte 624 verde.

### 6.4 Verificação de desafio (anti-cheat) — CONCLUÍDO
- [x] Edge Function que re-simula `(seed, InputTimeline)` e valida o score submetido.
      Entregue: verificação pura `verifyChallengeSubmission` (`src/services/online/verifyChallenge.ts`,
      importa só `@core/replay`) re-simula `{seed, trait:'none'}` + timeline e exige BOTH
      `hashMatches` (timeline reproduz o estado final) AND `fieldsMatch` (colunas
      `score/distance/food/nearMisses` batem com a re-sim — impede inflar coluna com hash
      válido). Bundle ESM autocontido (`_verify.bundle.js`, esbuild via `npm run build:edge`)
      + guarda de equivalência fonte↔bundle (staleness). Edge Function Deno
      `supabase/functions/verify-challenge/` (service_role) varre `challenge_entries`
      `verified=false` em lote e marca `verified=true` nos fiéis (idempotente; HTTP/cron).
      Cliente passa a submeter `challenge_entries` (daily/weekly) reusando `buildReplayPayload`
      (`OnlineClient.submitChallengeEntry`/`fetchVerifiedPlayers` + delegadores best-effort no
      `OnlineService` + fiação no `startGame.onGameOver`). Leaderboard central exibe selo ✓
      cruzando o conjunto verificado da seed (i18n `leaderboard.verified` nos 10 locales).
      **Não posso fazer deploy** (pré-req do usuário, molde 6.1): `npm run build:edge` +
      `supabase functions deploy verify-challenge`. `src/core/` intocado ⇒ determinismo **67
      inalterado**; suíte **637** verde. **Adiados:** auto-invocação pós-submit; gate real
      (esconder/ordenar por não-verificados) + verificar a coluna `scores` exibida (hoje o ✓
      atesta o replay, o score exibido vem de `scores` não-verificado); verificação de Endless.

### 6.5 Troféus centrais — CONCLUÍDO
- [x] Top-3 do desafio diário recebem troféu no perfil (sincronizado).
      Entregue, só serviços/app (`src/core/` intocado ⇒ determinismo **67 inalterado**):
      (1) **Sync de troféus** à tabela `jurassicrun.trophies` (6.1): seam
      `OnlineClient.submitTrophies`/`fetchTrophies` (upsert insert-only `ignoreDuplicates`
      pela RLS sem UPDATE) → delegadores best-effort no `OnlineService` (anexam `auth.uid()`)
      → interface injetável `TrophyOnline` + adapter (molde do leaderboard 6.3, `TrophyService`
      não importa `OnlineService`) → `TrophyService` online-aware: push dos recém-desbloqueados
      + **merge bidirecional** (união dos ids do servidor + push dos locais-só) na borda
      offline→online. (2) **Pódio diário CENTRAL**: `LeaderboardService.centralDailyRank(result)`
      computa o rank global da seed do dia **injetando o score recém-jogado** (elimina a corrida
      com o submit fire-and-forget) + seam `playerId`; `dailyPodium` destrava só por rank central
      quando online (estrito global), com fallback rank local quando offline. Fiação no
      `startGame.onGameOver` + `trophyService.init(undefined, createTrophyOnline())` no bootstrap.
      i18n: `dailyPodium.desc` perde "local" nos 10 locales (REGRA 4). Offline-first: sem `.env`
      ⇒ push/merge no-op, pódio usa rank local, jogo 100% igual. Suíte **652** verde; SDD por
      subagentes (6 tasks + review por task + review final opus **READY TO MERGE**, 0
      Critical/Important). **Decisão:** `dailyPodium` online = top-3 global / offline = top-3
      local (dupla natureza offline-first). **Adiados:** recuperação de troféu online cuja
      avaliação/push falha só re-tenta no próximo ciclo offline→online (best-effort, "sinal não
      gate"); troféus por-perfil (hoje globais); pódio semanal análogo; casca real de IO
      untested-by-unit (precedente).

## Definição de pronto
- Rankings centrais funcionando; verificação de desafio ativa; degrada graciosamente offline.
