import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA, TABLES, ONLINE_MODES } from './schema';
import type { OnlineConfig } from './config';

export type OnlineMode = (typeof ONLINE_MODES)[number];

export interface OnlinePlayer {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
}

export interface OnlineScoreInput {
  readonly playerId: string;
  readonly mode: OnlineMode;
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly level: number;
}

export interface OnlineScoreRow extends OnlineScoreInput {
  readonly playerName: string;
  readonly playerAvatar: string;
  readonly createdAt: number;
}

export interface OnlineClient {
  /** Garante uma sessão anônima; resolve com o `auth.uid()`. */
  signInAnonymously(): Promise<string>;
  /** Upsert do row `players` do jogador atual. */
  upsertPlayer(player: OnlinePlayer): Promise<void>;
  /** Submete um score ao servidor. */
  submitScore(input: OnlineScoreInput): Promise<void>;
  /** Busca scores por modo e opcionalmente por seed. */
  fetchScores(mode: OnlineMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
}

export interface MemoryOnlineClient extends OnlineClient {
  readonly upserts: OnlinePlayer[];
  readonly signInCount: number;
  readonly submittedScores: OnlineScoreInput[];
}

/** Spy determinístico p/ testes: sem rede. */
export function memoryOnlineClient(
  opts: { uid?: string; failSignIn?: boolean; scores?: OnlineScoreRow[] } = {},
): MemoryOnlineClient {
  const uid = opts.uid ?? 'memory-uid';
  const upserts: OnlinePlayer[] = [];
  const submittedScores: OnlineScoreInput[] = [];
  let signInCount = 0;
  return {
    upserts,
    submittedScores,
    get signInCount() {
      return signInCount;
    },
    async signInAnonymously() {
      signInCount += 1;
      if (opts.failSignIn === true) throw new Error('sign-in falhou (memory)');
      return uid;
    },
    async upsertPlayer(player) {
      upserts.push(player);
    },
    async submitScore(input) {
      submittedScores.push(input);
    },
    async fetchScores(mode, seed) {
      const all = opts.scores ?? [];
      return all.filter((r) => r.mode === mode && (seed === undefined || r.seed === seed));
    },
  };
}

/**
 * Casca real (não testada por unidade — molde de WebAudioEngine/localStorage*):
 * embrulha `@supabase/supabase-js`. Reusa a sessão anônima persistida antes de
 * criar uma nova, p/ não multiplicar usuários anônimos a cada boot.
 */
export function createSupabaseClient(config: OnlineConfig): OnlineClient {
  const supabase = createClient(config.url, config.anonKey, {
    db: { schema: SUPABASE_SCHEMA },
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return {
    async signInAnonymously() {
      const existing = await supabase.auth.getSession();
      const sessionUser = existing.data.session?.user;
      if (sessionUser) return sessionUser.id;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error !== null) throw error;
      const user = data.user;
      if (user === null) throw new Error('sign-in anônimo sem usuário');
      return user.id;
    },
    async upsertPlayer(player) {
      const { error } = await supabase
        .from(TABLES.players)
        .upsert({ id: player.id, name: player.name, avatar: player.avatar });
      if (error !== null) throw error;
    },
    async submitScore(input) {
      const { error } = await supabase.from(TABLES.scores).insert({
        player_id: input.playerId,
        mode: input.mode,
        seed: input.seed,
        score: input.score,
        distance: input.distance,
        food: input.food,
        near_misses: input.nearMisses,
        level: input.level,
      });
      if (error !== null) throw error;
    },
    async fetchScores(mode, seed) {
      let query = supabase
        .from(TABLES.scores)
        .select('player_id, mode, seed, score, distance, food, near_misses, level, created_at, players(name, avatar)')
        .eq('mode', mode)
        .order('score', { ascending: false })
        .limit(MAX_ONLINE_ROWS);
      if (seed !== undefined) query = query.eq('seed', seed);
      const { data, error } = await query;
      if (error !== null) throw error;
      return ((data ?? []) as unknown as RawScoreRow[]).map(mapScoreRow);
    },
  };
}

const MAX_ONLINE_ROWS = 80; // MAX_ENTRIES × 8 — folga p/ dedup por jogador no cliente

interface RawScoreRow {
  player_id: string;
  mode: string;
  seed: string;
  score: number;
  distance: number;
  food: number;
  near_misses: number;
  level: number;
  created_at: string;
  players: { name: string; avatar: string | null } | { name: string; avatar: string | null }[] | null;
}

function mapScoreRow(raw: RawScoreRow): OnlineScoreRow {
  const p = Array.isArray(raw.players) ? raw.players[0] : raw.players;
  return {
    playerId: raw.player_id,
    mode: raw.mode as OnlineMode,
    seed: raw.seed,
    score: raw.score,
    distance: raw.distance,
    food: raw.food,
    nearMisses: raw.near_misses,
    level: raw.level,
    playerName: p?.name ?? '',
    playerAvatar: p?.avatar ?? '',
    createdAt: Date.parse(raw.created_at) || 0,
  };
}
