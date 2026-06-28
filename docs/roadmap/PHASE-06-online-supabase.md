# Fase 6 — Online (Supabase)

**Objetivo:** recursos online atrás das interfaces já existentes dos services. Requer conta
Supabase (free tier) criada pelo usuário.

## Pré-requisito do usuário
- [ ] Criar projeto Supabase; fornecer URL + anon key (via `.env`, nunca commitado).

## Itens

### 6.1 Schema
- [ ] Tabelas: `players` (id global único, nome, avatar, criado_em), `scores`
      (player_id, modo, seed, score, distância, criado_em), `challenge_entries`,
      `trophies`. RLS adequada.

### 6.2 ID global de jogador
- [ ] Registrar jogador no servidor e obter ID único mundial; vincular ao perfil local.

### 6.3 Leaderboard central
- [ ] Submeter e ler rankings Endless/Diário/Semanal. `LeaderboardService` passa a usar
      Supabase mantendo fallback local/offline.

### 6.4 Verificação de desafio (anti-cheat)
- [ ] Edge Function que re-simula `(seed, InputTimeline)` e valida o score submetido.

### 6.5 Troféus centrais
- [ ] Top-3 do desafio diário recebem troféu no perfil (sincronizado).

## Definição de pronto
- Rankings centrais funcionando; verificação de desafio ativa; degrada graciosamente offline.
