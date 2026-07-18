-- 8.4 — Ledger de códigos de resgate (Ko-Fi). Single-use, service-role-only.
-- Idempotente (create-if-exists). Aplicar após 20260708000000_jr_schema.sql.

create table if not exists jurassicrun.redemption_codes (
  code        text primary key,
  sku         text not null,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table jurassicrun.redemption_codes enable row level security;

-- Sem policy de cliente: deny-by-default. Só a Edge Function (service_role) lê/grava.
