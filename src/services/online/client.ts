import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SCHEMA, TABLES } from './schema';
import type { OnlineConfig } from './config';

export interface OnlinePlayer {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
}

export interface OnlineClient {
  /** Garante uma sessão anônima; resolve com o `auth.uid()`. */
  signInAnonymously(): Promise<string>;
  /** Upsert do row `players` do jogador atual. */
  upsertPlayer(player: OnlinePlayer): Promise<void>;
}

export interface MemoryOnlineClient extends OnlineClient {
  readonly upserts: OnlinePlayer[];
  readonly signInCount: number;
}

/** Spy determinístico p/ testes: sem rede. */
export function memoryOnlineClient(
  opts: { uid?: string; failSignIn?: boolean } = {},
): MemoryOnlineClient {
  const uid = opts.uid ?? 'memory-uid';
  const upserts: OnlinePlayer[] = [];
  let signInCount = 0;
  return {
    upserts,
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
  };
}
