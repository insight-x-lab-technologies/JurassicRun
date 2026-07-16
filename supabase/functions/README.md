# Edge Functions — JurassicRun

## verify-challenge (item 6.4 — anti-cheat)

Re-simula `(seed, timeline)` de `challenge_entries` não-verificados e marca `verified=true`
nos fiéis (hash do estado final + colunas de score batem com a re-sim). Só o `service_role`
passa pelo trigger `lock_verified`, então a função roda com a service_role key.

O verificador é o bundle `_verify.bundle.js`, gerado de `src/services/online/verifyChallenge.ts`
por `npm run build:edge` (guarda de equivalência em `tests/online/edge-bundle.test.ts`).
**Regenere o bundle e re-deploy sempre que `src/core/` ou o verificador mudar.**

### Deploy (pré-requisito do usuário)
```bash
npm run build:edge                          # (re)gera _verify.bundle.js
supabase functions deploy verify-challenge  # requer supabase CLI + login no projeto
```
As env `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo runtime
das Edge Functions (não precisa `secrets set` para elas).

### Invocação
Idempotente (só processa `verified=false`). Rode por HTTP após submissões, ou agende:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/verify-challenge" -H "Authorization: Bearer $ANON_KEY"
```
Opcional: agendar via `pg_cron`/Scheduled Functions do dashboard (ex.: a cada 5 min).
