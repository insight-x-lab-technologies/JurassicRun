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

### 5.2 Leaderboards locais
- [ ] Armazenar recordes locais por modo: Endless, Diário, Semanal.
- [ ] Tela de Leaderboard com as três abas.

### 5.3 Troféus de desafio (local)
- [ ] Top-3 local do desafio diário ganham troféu (placeholder até o central da Fase 6).

### 5.4 Integridade
- [ ] Guardar `seed` + `InputTimeline` da melhor tentativa (prepara verificação online).

## Definição de pronto
- Dá para jogar os desafios determinísticos e ver rankings locais nas três categorias.
