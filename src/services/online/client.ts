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

export interface OnlineChallengeInput {
  readonly playerId: string;
  readonly mode: 'daily' | 'weekly';
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly timeline: readonly boolean[];
  readonly finalHash: string;
}

/** Resposta do resgate de código (Edge Function `redeem-code`, 8.4). */
export interface RedeemResponse {
  readonly ok: boolean;
  readonly sku?: string;
  readonly reason?: 'invalid' | 'used' | 'error';
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
  /** Upsert de um replay de desafio verificável (1 por player+seed). */
  submitChallengeEntry(input: OnlineChallengeInput): Promise<void>;
  /** player_ids com challenge_entry verificado nesse modo+seed. */
  fetchVerifiedPlayers(mode: OnlineMode, seed: string): Promise<readonly string[]>;
  /** Insert-only dos troféus do jogador (idempotente; UPDATE não permitido pela RLS). */
  submitTrophies(playerId: string, ids: readonly string[]): Promise<void>;
  /** trophy_ids desbloqueados do jogador. */
  fetchTrophies(playerId: string): Promise<readonly string[]>;
}

export interface MemoryOnlineClient extends OnlineClient {
  readonly upserts: OnlinePlayer[];
  readonly signInCount: number;
  readonly submittedScores: OnlineScoreInput[];
  readonly submittedChallenges: OnlineChallengeInput[];
  readonly submittedTrophies: { playerId: string; ids: readonly string[] }[];
}

/** Spy determinístico p/ testes: sem rede. */
export function memoryOnlineClient(
  opts: {
    uid?: string;
    failSignIn?: boolean;
    scores?: OnlineScoreRow[];
    verifiedPlayers?: string[];
    trophies?: string[];
  } = {},
): MemoryOnlineClient {
  const uid = opts.uid ?? 'memory-uid';
  const upserts: OnlinePlayer[] = [];
  const submittedScores: OnlineScoreInput[] = [];
  const submittedChallenges: OnlineChallengeInput[] = [];
  const submittedTrophies: { playerId: string; ids: readonly string[] }[] = [];
  let signInCount = 0;
  return {
    upserts,
    submittedScores,
    submittedChallenges,
    submittedTrophies,
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
    async submitChallengeEntry(input) {
      submittedChallenges.push(input);
    },
    async fetchVerifiedPlayers() {
      return opts.verifiedPlayers ?? [];
    },
    async submitTrophies(playerId, ids) {
      submittedTrophies.push({ playerId, ids });
    },
    async fetchTrophies() {
      return opts.trophies ?? [];
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
    async submitChallengeEntry(input) {
      const { error } = await supabase
        .from(TABLES.challengeEntries)
        .upsert(
          {
            player_id: input.playerId, mode: input.mode, seed: input.seed,
            score: input.score, distance: input.distance, food: input.food,
            near_misses: input.nearMisses, timeline: input.timeline, final_hash: input.finalHash,
          },
          { onConflict: 'player_id,seed' },
        );
      if (error !== null) throw error;
    },
    async fetchVerifiedPlayers(mode, seed) {
      const { data, error } = await supabase
        .from(TABLES.challengeEntries)
        .select('player_id')
        .eq('mode', mode)
        .eq('seed', seed)
        .eq('verified', true);
      if (error !== null) throw error;
      return ((data ?? []) as { player_id: string }[]).map((r) => r.player_id);
    },
    async submitTrophies(playerId, ids) {
      if (ids.length === 0) return;
      const rows = ids.map((trophy_id) => ({ player_id: playerId, trophy_id }));
      const { error } = await supabase
        .from(TABLES.trophies)
        .upsert(rows, { onConflict: 'player_id,trophy_id', ignoreDuplicates: true });
      if (error !== null) throw error;
    },
    async fetchTrophies(playerId) {
      const { data, error } = await supabase
        .from(TABLES.trophies)
        .select('trophy_id')
        .eq('player_id', playerId);
      if (error !== null) throw error;
      return ((data ?? []) as { trophy_id: string }[]).map((r) => r.trophy_id);
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
