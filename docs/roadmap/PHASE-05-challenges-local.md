# Fase 5 — Desafios & leaderboards locais

**Objetivo:** modos Desafio Diário e Semanal jogáveis com seeds determinísticas e rankings
locais no aparelho.

## Itens

### 5.1 Modo Desafio ✅
- [x] Diário: seed do dia (UTC). Semanal: seed da semana ISO. Uma tentativa rankeável por
      período (regra definida: **melhor tentativa**; tentativas ilimitadas — a gravação do
      recorde por período é 5.2).
- [x] HUD mostra a seed do desafio (via `seedLabel` → `hud.seed`; prefixo `daily:`/`weekly:`
      identifica o modo).

### 5.2 Leaderboards locais ✅
- [x] Armazenar recordes locais por modo: Endless, Diário, Semanal (serviço
      `src/services/leaderboard/`; ranking por **score**; Endless top-10 por corrida,
      Diário/Semanal deduplicado por seed = melhor tentativa por período).
- [x] Tela de Leaderboard com as três abas (rota `leaderboard`; medalhas 🥇🥈🥉, seed do
      período, detalhe distância/comida/near-misses). Religa o seam `maxLevel` da Home =
      `bestEndlessLevel`.

### 5.3 Troféus de desafio (local) ✅
- [x] Top-3 local do desafio diário ganham troféu (`dailyPodium`; predicado do troféu passa a
      `(ctx)=>boolean` com `ctx={stats, dailyRank?}`; `dailyRank` vem de
      `leaderboardService.dailyRankForSeed`, injetado no Game Over só no modo `daily`).
      Placeholder até o central da Fase 6.

### 5.4 Integridade
- [ ] Guardar `seed` + `InputTimeline` da melhor tentativa (prepara verificação online).

## Definição de pronto
- Dá para jogar os desafios determinísticos e ver rankings locais nas três categorias.
