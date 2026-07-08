-- JurassicRun — schema online (item 6.1). Isolamento por schema dedicado num banco
-- Supabase compartilhado. Idempotente: seguro reaplicar. Identidade via auth anônimo
-- (players.id = auth.uid()); flag `verified` travada ao service_role (anti-cheat 6.4).

create schema if not exists jurassicrun;

-- ── players ────────────────────────────────────────────────────────────────
create table if not exists jurassicrun.players (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 20),
  avatar     text,
  created_at timestamptz not null default now()
);

-- ── scores (leaderboard, todos os modos) ─────────────────────────────────────
create table if not exists jurassicrun.scores (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references jurassicrun.players(id) on delete cascade,
  mode        text not null check (mode in ('endless','daily','weekly')),
  seed        text not null,
  score       double precision not null,
  distance    double precision not null,
  food        integer not null check (food >= 0),
  near_misses integer not null check (near_misses >= 0),
  level       integer not null check (level >= 0),
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists scores_mode_score_idx
  on jurassicrun.scores (mode, score desc);

-- ── challenge_entries (replays verificáveis, Diário/Semanal) ──────────────────
create table if not exists jurassicrun.challenge_entries (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references jurassicrun.players(id) on delete cascade,
  mode        text not null check (mode in ('daily','weekly')),
  seed        text not null,
  score       double precision not null,
  distance    double precision not null,
  food        integer not null check (food >= 0),
  near_misses integer not null check (near_misses >= 0),
  timeline    jsonb not null,
  final_hash  text not null check (final_hash <> ''),
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (player_id, seed)
);

-- ── trophies (conquistas por jogador) ────────────────────────────────────────
create table if not exists jurassicrun.trophies (
  player_id   uuid not null references jurassicrun.players(id) on delete cascade,
  trophy_id   text not null,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, trophy_id)
);

-- ── trigger de integridade: só o service_role pode marcar verified=true ──────
create or replace function jurassicrun.lock_verified()
returns trigger language plpgsql as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.verified := false;
  end if;
  return new;
end $$;

drop trigger if exists lock_verified on jurassicrun.scores;
create trigger lock_verified before insert or update on jurassicrun.scores
  for each row execute function jurassicrun.lock_verified();

drop trigger if exists lock_verified on jurassicrun.challenge_entries;
create trigger lock_verified before insert or update on jurassicrun.challenge_entries
  for each row execute function jurassicrun.lock_verified();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table jurassicrun.players            enable row level security;
alter table jurassicrun.scores             enable row level security;
alter table jurassicrun.challenge_entries  enable row level security;
alter table jurassicrun.trophies           enable row level security;

-- players: leitura pública; escrita só da própria linha.
drop policy if exists players_select_public on jurassicrun.players;
create policy players_select_public on jurassicrun.players
  for select using (true);
drop policy if exists players_insert_own on jurassicrun.players;
create policy players_insert_own on jurassicrun.players
  for insert with check (id = auth.uid());
drop policy if exists players_update_own on jurassicrun.players;
create policy players_update_own on jurassicrun.players
  for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists players_delete_own on jurassicrun.players;
create policy players_delete_own on jurassicrun.players
  for delete using (id = auth.uid());

-- scores: leitura pública; insert da própria linha; imutável (sem update/delete no cliente).
drop policy if exists scores_select_public on jurassicrun.scores;
create policy scores_select_public on jurassicrun.scores
  for select using (true);
drop policy if exists scores_insert_own on jurassicrun.scores;
create policy scores_insert_own on jurassicrun.scores
  for insert with check (player_id = auth.uid());

-- challenge_entries: leitura pública; insert/update da própria linha (melhor tentativa).
drop policy if exists challenge_entries_select_public on jurassicrun.challenge_entries;
create policy challenge_entries_select_public on jurassicrun.challenge_entries
  for select using (true);
drop policy if exists challenge_entries_insert_own on jurassicrun.challenge_entries;
create policy challenge_entries_insert_own on jurassicrun.challenge_entries
  for insert with check (player_id = auth.uid());
drop policy if exists challenge_entries_update_own on jurassicrun.challenge_entries;
create policy challenge_entries_update_own on jurassicrun.challenge_entries
  for update using (player_id = auth.uid()) with check (player_id = auth.uid());

-- trophies: leitura pública; insert da própria linha (centrais via service_role).
drop policy if exists trophies_select_public on jurassicrun.trophies;
create policy trophies_select_public on jurassicrun.trophies
  for select using (true);
drop policy if exists trophies_insert_own on jurassicrun.trophies;
create policy trophies_insert_own on jurassicrun.trophies
  for insert with check (player_id = auth.uid());
