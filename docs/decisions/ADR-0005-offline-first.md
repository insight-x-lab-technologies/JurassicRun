# ADR-0005 — Offline-first com Supabase posterior
- Status: Aceita
- Data: 2026-06-27

## Contexto
Recursos online (ID global, leaderboard central, verificação de desafio) dependem de uma
conta Supabase que o usuário precisa criar. Não devemos travar o desenvolvimento por isso.

## Decisão
Construir tudo funcionando 100% offline (perfis locais, recordes locais, seeds
determinísticas) atrás de interfaces de service (`PersistenceService`, `LeaderboardService`,
`ProfileService`). A integração Supabase entra como fase dedicada (Fase 6), trocando a
implementação dos services com fallback offline.

## Consequências
- Progresso independe de setup externo nas fases iniciais.
- Online é incremental e degradável; jogo funciona sem rede.

## Alternativas consideradas
- Supabase desde o início: cria dependência externa cedo e bloqueia fases iniciais. Rejeitada.
