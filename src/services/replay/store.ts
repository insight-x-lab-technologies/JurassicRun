export type ReplayMode = 'daily' | 'weekly';

/** Replay verificável de uma tentativa: seed + timeline + âncora de integridade (hash final). */
export interface StoredReplay {
  readonly mode: ReplayMode;
  readonly seed: string;
  readonly timeline: readonly boolean[]; // flap por step de simulação
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly finalHash: string; // hashState(WorldState final) — o que a verificação recomputa
  readonly achievedAt: number;
}

export interface ReplayState {
  readonly daily: readonly StoredReplay[];
  readonly weekly: readonly StoredReplay[];
}

export const MAX_REPLAYS = 10;

export function initialReplayState(): ReplayState {
  return { daily: [], weekly: [] };
}

/** Saneia para inteiro não-negativo (NaN/negativo/∞/fração ⇒ floor ≥ 0). Molde do leaderboard. */
export function sanitizeStat(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function normalize(r: StoredReplay): StoredReplay {
  return {
    mode: r.mode,
    seed: r.seed,
    timeline: r.timeline,
    score: sanitizeStat(r.score),
    distance: sanitizeStat(r.distance),
    food: sanitizeStat(r.food),
    nearMisses: sanitizeStat(r.nearMisses),
    finalHash: r.finalHash,
    achievedAt: Number.isFinite(r.achievedAt) ? r.achievedAt : 0,
  };
}

/** Ordena por score desc; desempate achievedAt asc; depois seed (estabilidade total). */
function rank(list: StoredReplay[]): StoredReplay[] {
  return list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.achievedAt !== b.achievedAt) return a.achievedAt - b.achievedAt;
    return a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0;
  });
}

/** Dedup por seed (mantém maior score); insere e trunca top-N. Mesma ref se não melhora. */
function insert(list: readonly StoredReplay[], entry: StoredReplay): readonly StoredReplay[] {
  const existing = list.find((e) => e.seed === entry.seed);
  if (existing && entry.score <= existing.score) return list; // não melhora ⇒ no-op
  const without = existing ? list.filter((e) => e.seed !== entry.seed) : list;
  return rank([...without, entry]).slice(0, MAX_REPLAYS);
}

/** Grava um replay no modo certo. Imutável. Mesma ref se nada mudou. */
export function recordReplay(state: ReplayState, replay: StoredReplay): ReplayState {
  const entry = normalize(replay);
  const key = entry.mode; // 'daily' | 'weekly'
  const nextList = insert(state[key], entry);
  if (nextList === state[key]) return state;
  return { ...state, [key]: nextList };
}
