import { TROPHY_CATALOG } from './catalog';

/** Agregado vitalício. Todos inteiros ≥ 0. */
export interface TrophyStats {
  readonly gamesPlayed: number;
  readonly totalFood: number;
  readonly totalDistance: number;
  readonly bestDistance: number;
  readonly bestNearMisses: number;
  readonly bestScore: number;
}

/** Resultado de UMA partida (desacoplado de WorldState). */
export interface MatchSummary {
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly score: number;
}

export interface TrophyState {
  readonly stats: TrophyStats;
  readonly unlocked: readonly string[];
}

export function emptyStats(): TrophyStats {
  return {
    gamesPlayed: 0, totalFood: 0, totalDistance: 0,
    bestDistance: 0, bestNearMisses: 0, bestScore: 0,
  };
}

export function initialTrophyState(): TrophyState {
  return { stats: emptyStats(), unlocked: [] };
}

/** Saneia para inteiro não-negativo (NaN/negativo/fração ⇒ floor≥0). */
export function sanitizeStat(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Dobra uma partida no agregado. Imutável; não muta a entrada. */
export function foldMatch(stats: TrophyStats, m: MatchSummary): TrophyStats {
  const distance = sanitizeStat(m.distance);
  const food = sanitizeStat(m.food);
  const nearMisses = sanitizeStat(m.nearMisses);
  const score = sanitizeStat(m.score);
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    totalFood: stats.totalFood + food,
    totalDistance: stats.totalDistance + distance,
    bestDistance: Math.max(stats.bestDistance, distance),
    bestNearMisses: Math.max(stats.bestNearMisses, nearMisses),
    bestScore: Math.max(stats.bestScore, score),
  };
}

/** Desbloqueia toda conquista satisfeita e ainda-não-desbloqueada. Mesmo objeto se nada muda. */
export function evaluate(state: TrophyState): { state: TrophyState; newlyUnlocked: readonly string[] } {
  const newlyUnlocked: string[] = [];
  for (const def of TROPHY_CATALOG) {
    if (!state.unlocked.includes(def.id) && def.condition(state.stats)) {
      newlyUnlocked.push(def.id);
    }
  }
  if (newlyUnlocked.length === 0) return { state, newlyUnlocked };
  return { state: { ...state, unlocked: [...state.unlocked, ...newlyUnlocked] }, newlyUnlocked };
}

/** Dobra a partida e reavalia. Imutável. */
export function recordMatch(state: TrophyState, m: MatchSummary): { state: TrophyState; newlyUnlocked: readonly string[] } {
  return evaluate({ stats: foldMatch(state.stats, m), unlocked: state.unlocked });
}
