# Supabase — JurassicRun (Fase 6)

Banco compartilhado `InsightXLabGamesHub`. Todos os objetos do JurassicRun vivem no
**schema dedicado `jurassicrun`** (isolamento de multi-projeto — sem colisão de nomes).

## Aplicar a migração

**Opção A — SQL Editor (dashboard):** cole o conteúdo de
`migrations/20260708000000_jr_schema.sql` e rode. É idempotente (seguro reaplicar).

**Opção B — Supabase CLI:** `supabase db push` (requer `supabase link` ao projeto
`wpbryudhqerpnzbpmcio` com a senha do Postgres).

## Passos manuais no dashboard (uma vez)

1. **Settings → API → Exposed schemas:** adicionar `jurassicrun` (senão o PostgREST/anon
   key não enxerga as tabelas). O cliente JS usará
   `createClient(url, key, { db: { schema: 'jurassicrun' } })` (wiring em 6.2).
2. **Authentication → Providers → Anonymous sign-ins:** habilitar (o 6.2 registra o
   jogador via anonymous sign-in; `players.id = auth.uid()`).

## Modelo de segurança

- RLS ligada em todas as tabelas. Leitura pública (leaderboards mostram nomes/troféus);
  escrita só da própria linha (`= auth.uid()`).
- `scores`/`challenge_entries` têm `verified`, travada em `false` para o cliente por
  trigger `lock_verified`. Só a Edge Function de verificação (6.4, service_role) marca
  `verified = true` após re-simular `(seed, timeline)` e conferir `final_hash`.

## redeem-code (Edge Function, 8.4)

Valida códigos de resgate single-use (compras Ko-Fi). Deploy:

    supabase functions deploy redeem-code

Precisa das envs padrão da função (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — providas
pelo runtime). Ao fulfillar um pedido Ko-Fi, insira o código e o SKU na tabela:

    insert into jurassicrun.redemption_codes (code, sku)
    values ('ABC123', 'coins:medium');

SKUs válidos: `coins:small|medium|large`, `expansion:volcano|glacier`. O jogador cola o
código na Loja/Expansões; a função marca `redeemed_by`/`redeemed_at` no 1º resgate e recusa
os seguintes (`used`).
