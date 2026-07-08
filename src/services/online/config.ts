/** Configuração do cliente Supabase, derivada do ambiente Vite. */
export interface OnlineConfig {
  readonly url: string;
  readonly anonKey: string;
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Puro: extrai a config de um objeto env-like. Devolve `null` (⇒ modo offline)
 * quando qualquer uma das chaves obrigatórias falta ou não é string não-vazia.
 */
export function parseOnlineConfig(env: Record<string, unknown>): OnlineConfig | null {
  const url = env['VITE_SUPABASE_URL'];
  const anonKey = env['VITE_SUPABASE_ANON_KEY'];
  if (!nonEmptyString(url) || !nonEmptyString(anonKey)) return null;
  return { url, anonKey };
}

/** Casca: lê o ambiente Vite (`import.meta.env`). */
export function onlineConfig(): OnlineConfig | null {
  return parseOnlineConfig(import.meta.env as unknown as Record<string, unknown>);
}
