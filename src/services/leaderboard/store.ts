export type LeaderboardMode = 'endless' | 'daily' | 'weekly';

export interface LeaderboardEntry {
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly achievedAt: number;
}

/** Resultado de UMA partida a gravar (desacoplado de WorldState). */
export interface LeaderboardResult {
  readonly mode: LeaderboardMode;
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly level: number;
  readonly achievedAt: number;
}

export interface LeaderboardState {
  readonly endless: readonly LeaderboardEntry[];
  readonly daily: readonly LeaderboardEntry[];
  readonly weekly: readonly LeaderboardEntry[];
  readonly bestEndlessLevel: number;
}

export const MAX_ENTRIES = 10;

export function initialLeaderboardState(): LeaderboardState {
  return { endless: [], daily: [], weekly: [], bestEndlessLevel: 0 };
}

/** Saneia para inteiro não-negativo (NaN/negativo/∞/fração ⇒ floor ≥ 0). */
export function sanitizeStat(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function entryFromResult(r: LeaderboardResult): LeaderboardEntry {
  return {
    seed: r.seed,
    score: sanitizeStat(r.score),
    distance: sanitizeStat(r.distance),
    food: sanitizeStat(r.food),
    nearMisses: sanitizeStat(r.nearMisses),
    achievedAt: Number.isFinite(r.achievedAt) ? r.achievedAt : 0,
  };
}

/** Ordena por score desc; desempate achievedAt asc; depois seed (estabilidade total). */
function rank(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.achievedAt !== b.achievedAt) return a.achievedAt - b.achievedAt;
    return a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0;
  });
}

/** Endless: insere e trunca top-N. Sempre muda (nova ref). */
function insertRanked(list: readonly LeaderboardEntry[], entry: LeaderboardEntry): readonly LeaderboardEntry[] {
  return rank([...list, entry]).slice(0, MAX_ENTRIES);
}

/**
 * Diário/Semanal: dedup por seed (mantém maior score). Devolve a MESMA ref se a nova
 * entrada não superar o recorde já existente daquele período.
 */
function insertPeriodic(list: readonly LeaderboardEntry[], entry: LeaderboardEntry): readonly LeaderboardEntry[] {
  const existing = list.find((e) => e.seed === entry.seed);
  if (existing) {
    if (entry.score <= existing.score) return list; // não melhora ⇒ no-op
    const replaced = list.map((e) => (e.seed === entry.seed ? entry : e));
    return rank([...replaced]).slice(0, MAX_ENTRIES);
  }
  return rank([...list, entry]).slice(0, MAX_ENTRIES);
}

/** Grava um resultado no modo certo. Imutável. Mesma ref se nada mudou. */
export function recordMatch(state: LeaderboardState, r: LeaderboardResult): LeaderboardState {
  const entry = entryFromResult(r);
  if (r.mode === 'endless') {
    const level = sanitizeStat(r.level);
    return {
      ...state,
      endless: insertRanked(state.endless, entry),
      bestEndlessLevel: Math.max(state.bestEndlessLevel, level),
    };
  }
  const key = r.mode; // 'daily' | 'weekly'
  const nextList = insertPeriodic(state[key], entry);
  if (nextList === state[key]) return state; // no-op periódico ⇒ mesma ref
  return { ...state, [key]: nextList };
}

/** Posição 1-based da entrada com essa seed na lista (já ranqueada); undefined se ausente. */
export function rankOf(list: readonly LeaderboardEntry[], seed: string): number | undefined {
  const idx = list.findIndex((e) => e.seed === seed);
  return idx === -1 ? undefined : idx + 1;
}
