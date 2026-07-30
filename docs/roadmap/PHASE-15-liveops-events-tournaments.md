# Fase 15 — Live-ops: eventos temáticos & torneios semanais

**Objetivo:** retenção de longo prazo com conteúdo recorrente barato: eventos temáticos definidos
por dados (JSON no repo, sem servidor obrigatório) e torneio semanal competitivo sobre a infra de
desafios + leaderboard central que já existe. Cosméticos exclusivos criam FOMO honesto e mais um
sink de moedas.

> Design aprovado: `docs/superpowers/specs/2026-07-30-monetization-roadmap-design.md`.

## Premissas (NÃO violar)

- `src/core/` **intocado**: evento usa os eixos de modificadores existentes (9.9) e seeds
  especiais; nada de física nova.
- Offline-first: evento aparece/funciona sem rede (janela por relógio local vs datas UTC do
  JSON); torneio degrada para o desafio semanal normal sem rede.
- Justiça: torneio herda o anti-cheat 6.4 (re-sim server-side) — sem exceções.
- Cosmético exclusivo = entitlement permanente após obtido; a exclusividade é da JANELA de
  obtenção, nunca remoção retroativa.

## Itens

### 15.1 Sistema de eventos temáticos
- [ ] Evento = entrada em `events.json` versionado no repo: `{id, startsAt/endsAt (UTC ISO),
      tema/expansão, seedTag, missões extras (templates 11.2), itens exclusivos de loja,
      chaves i18n}`. Novo evento = PR de dados, zero código.
- [ ] `activeEvent(now, defs)` puro + banner na Home + desafio do evento (seed derivada do
      `seedTag`, mesma mecânica do diário) + aba/loja de evento com o cosmético exclusivo.
- [ ] Primeiro evento de estreia: "Semana do Vulcão" (tema volcano já existe como expansão).

**Toca:** serviço novo, Home, Loja, desafios (reuso), i18n, asset-spec do cosmético.
**Aceite:** evento liga/desliga pela janela em teste de relógio simulado; fora da janela o item
some da loja mas quem tem mantém; novo evento entra só com JSON+i18n+arte.

### 15.2 Torneio semanal
- [ ] Liga sobre o desafio semanal existente: ao fechar a semana ISO, snapshot do leaderboard
      central (função agendada no Supabase) congela o ranking oficial.
- [ ] Premiação por faixa (top 1/3/10/25%): moedas + cosmético exclusivo da semana para o topo.
      Claim no client via Edge Function `claim-tournament-reward` (verifica rank no snapshot,
      credita 1×, molde do claim atômico 8.4).
- [ ] UI: aba Torneio no leaderboard (posição ao vivo, prêmio projetado, histórico de semanas).
- [ ] Anti-cheat: só entradas `verified` (6.4) contam para prêmio.

**Toca:** Supabase (tabela snapshot + cron + Edge Function), leaderboard UI, i18n.
**Aceite:** semana fecha ⇒ snapshot imutável; claim credita 1× e só para rank elegível; sem rede
a aba degrada com aviso; entrada não-verificada não premia.

### 15.3 Calendário & aviso de eventos
- [ ] Home mostra próximo evento/fechamento de torneio (contagem regressiva).
- [ ] Notificação local opcional (Notification API com app aberto/SW). **Web push com servidor:
      adiado** — exigiria backend de push; registrar como débito consciente.

**Toca:** Home, SW, Settings (permissão), i18n. **Aceite:** contagens corretas em teste de relógio
simulado; permissão negada não quebra nada.

## Ordem de execução

15.1 → 15.2 → 15.3. Um item por PR.

## Definição de pronto (fase)

- `check` + suíte inteira verdes; core intocado.
- Evento de estreia agendado e testado; primeiro torneio semanal fechado de ponta a ponta
  (snapshot → claim) em ambiente de teste; calendário na Home.
