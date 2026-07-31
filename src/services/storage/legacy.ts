/**
 * Purga de chaves de `localStorage` aposentadas (item 10.3).
 *
 * Pré-lançamento, a decisão do usuário é DESCARTAR dado legado, nunca migrar. Fonte principal:
 * os bumps de versão da chave de replays (v1→v2→v3, feitos em 9.8 e 9.9). O leaderboard local
 * (v1) é adicionado à lista em Task 2 (quando a chave é bumpada para v2).
 *
 * A lista é EXPLÍCITA de propósito: um varredor por prefixo/versão apagaria dado vivo no primeiro
 * formato de chave inesperado, e o custo do erro é assimétrico.
 */
export const LEGACY_STORAGE_KEYS: readonly string[] = [
  'jurassicrun.replays.v1',     // aposentada em 9.8 (catálogo de obstáculos novo)
  'jurassicrun.replays.v2',     // aposentada em 9.9 (modificadores por seed)
];

/** Fatia mínima de `Storage` que a purga precisa — mantém a função pura e testável. */
export interface LegacyStore {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

/** PURO: remove só as chaves presentes e devolve as que removeu. */
export function purgeLegacyKeys(
  store: LegacyStore,
  keys: readonly string[] = LEGACY_STORAGE_KEYS,
): string[] {
  const removed: string[] = [];
  for (const key of keys) {
    if (store.getItem(key) === null) continue;
    store.removeItem(key);
    removed.push(key);
  }
  return removed;
}

/**
 * CASCA: aplica a purga no `localStorage` real. Best-effort — o acesso ao global pode lançar
 * (Safari em modo privado lança na PROPRIEDADE, não só na chamada) e a remoção também. Lixo
 * órfão nunca pode derrubar o boot.
 */
export function purgeLegacyStorage(): string[] {
  try {
    return purgeLegacyKeys(localStorage);
  } catch {
    return [];
  }
}
