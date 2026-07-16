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

### 6.4 Verificação de desafio (anti-cheat)
- [ ] Edge Function que re-simula `(seed, InputTimeline)` e valida o score submetido.

### 6.5 Troféus centrais
- [ ] Top-3 do desafio diário recebem troféu no perfil (sincronizado).

## Definição de pronto
- Rankings centrais funcionando; verificação de desafio ativa; degrada graciosamente offline.
