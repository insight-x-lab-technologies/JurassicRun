/**
 * Constantes do schema online (Supabase) do JurassicRun — fonte única da verdade
 * compartilhada entre a guarda de contrato do SQL e os serviços online (6.2+).
 * TS puro: sem IO, sem `@supabase`. Isolamento por schema Postgres dedicado.
 */
export const SUPABASE_SCHEMA = 'jurassicrun' as const;

export const TABLES = {
  players: 'players',
  scores: 'scores',
  challengeEntries: 'challenge_entries',
  trophies: 'trophies',
} as const;

export const TABLE_NAMES = [
  TABLES.players,
  TABLES.scores,
  TABLES.challengeEntries,
  TABLES.trophies,
] as const;

export const ONLINE_MODES = ['endless', 'daily', 'weekly'] as const;

/** Tabelas com flag `verified` travada ao service_role via trigger `lock_verified`. */
export const VERIFIED_TABLES = ['scores', 'challenge_entries'] as const;

/** Colunas esperadas por tabela — a guarda de contrato casa isto com a migração `.sql`. */
export const TABLE_COLUMNS: Record<(typeof TABLE_NAMES)[number], readonly string[]> = {
  players: ['id', 'name', 'avatar', 'created_at'],
  scores: [
    'id', 'player_id', 'mode', 'seed', 'score', 'distance',
    'food', 'near_misses', 'level', 'verified', 'created_at',
  ],
  challenge_entries: [
    'id', 'player_id', 'mode', 'seed', 'score', 'distance',
    'food', 'near_misses', 'timeline', 'final_hash', 'verified', 'created_at',
  ],
  trophies: ['player_id', 'trophy_id', 'unlocked_at'],
};

/** Tabela service-role-only (ledger de códigos de resgate, 8.4). Fora de TABLE_NAMES:
 *  deny-by-default, sem policy de cliente. */
export const REDEMPTION_TABLE = 'redemption_codes' as const;

export const REDEMPTION_COLUMNS: readonly string[] = [
  'code', 'sku', 'redeemed_by', 'redeemed_at', 'created_at',
];
