import { PODIUM_RANK, TROPHY_CATALOG } from './catalog';

/** Modo da partida. União declarada aqui de propósito: o serviço de troféus não depende de
 *  `@services/leaderboard` nem de `@render/matchFactory` — as uniões são estruturalmente iguais. */
export type TrophyMatchMode = 'endless' | 'daily' | 'weekly';

/** Agregado vitalício. Todos inteiros ≥ 0. */
export interface TrophyStats {
  readonly gamesPlayed: number;
  readonly totalFood: number;
  readonly totalDistance: number;
  readonly bestDistance: number;
  readonly bestNearMisses: number;
  readonly bestScore: number;
  // ── 10.7 ──────────────────────────────────────────────────────────────────
  /** Maior nível alcançado numa partida. */
  readonly bestLevel: number;
  /** Near-misses somados na vida (o `bestNearMisses` é o pico de UMA partida). */
  readonly totalNearMisses: number;
  /** Power-ups apanhados na vida (contados pelo render — o core não guarda isso). */
  readonly totalPowerups: number;
  /** Moedas CREDITADAS na vida. Lê o valor creditado, não a comida (ver 10.4). */
  readonly totalCoins: number;
  /** Partidas em modo Diário ou Semanal. */
  readonly challengesPlayed: number;
  readonly dailyPodiums: number;
  readonly weeklyPodiums: number;
  /** Melhor score numa partida de desafio (Diário ou Semanal). */
  readonly bestChallengeScore: number;
  /** Dias UTC distintos com ao menos uma partida. */
  readonly daysPlayed: number;
  /** Dia-época UTC da última partida. Estado de suporte do `daysPlayed`, não é exibível. */
  readonly lastPlayDay: number;
}

/** Resultado de UMA partida (desacoplado de WorldState). */
export interface MatchSummary {
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly score: number;
  /** Nível atingido ao morrer. */
  readonly level: number;
  /** Moedas creditadas por esta partida. */
  readonly coins: number;
  /** Power-ups apanhados nesta partida. */
  readonly powerups: number;
  readonly mode: TrophyMatchMode;
  /** Epoch ms do fim da partida (vem da casca; o agregado não lê relógio). */
  readonly playedAt: number;
}

export interface TrophyState {
  readonly stats: TrophyStats;
  readonly unlocked: readonly string[];
}

/** Contexto de avaliação: agregado vitalício + fatos transientes da partida recém-terminada. */
export interface TrophyEvalContext {
  readonly stats: TrophyStats;
  /** rank 1-based no leaderboard diário; ausente fora do Diário. */
  readonly dailyRank?: number;
  /** rank 1-based no leaderboard semanal; ausente fora do Semanal. */
  readonly weeklyRank?: number;
}

export function emptyStats(): TrophyStats {
  return {
    gamesPlayed: 0, totalFood: 0, totalDistance: 0,
    bestDistance: 0, bestNearMisses: 0, bestScore: 0,
    bestLevel: 0, totalNearMisses: 0, totalPowerups: 0, totalCoins: 0,
    challengesPlayed: 0, dailyPodiums: 0, weeklyPodiums: 0, bestChallengeScore: 0,
    daysPlayed: 0, lastPlayDay: 0,
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

const MS_PER_DAY = 86_400_000;

/** Dia UTC (inteiro ≥ 0) de um instante em epoch ms. Puro: só floor e divisão. */
export function epochDay(ms: number): number {
  return sanitizeStat(sanitizeStat(ms) / MS_PER_DAY);
}

/** Dobra uma partida no agregado. Imutável; não muta a entrada. */
export function foldMatch(stats: TrophyStats, m: MatchSummary): TrophyStats {
  const distance = sanitizeStat(m.distance);
  const food = sanitizeStat(m.food);
  const nearMisses = sanitizeStat(m.nearMisses);
  const score = sanitizeStat(m.score);
  const level = sanitizeStat(m.level);
  const coins = sanitizeStat(m.coins);
  const powerups = sanitizeStat(m.powerups);
  const isChallenge = m.mode === 'daily' || m.mode === 'weekly';

  // Dia novo: `lastPlayDay` só avança para frente (relógio para trás não duplica nem decrementa).
  // `gamesPlayed === 0` é o caso "nunca jogou", em que qualquer dia — inclusive o 0 — é novo.
  const day = epochDay(m.playedAt);
  const isNewDay = stats.gamesPlayed === 0 || day > stats.lastPlayDay;

  return {
    gamesPlayed: stats.gamesPlayed + 1,
    totalFood: stats.totalFood + food,
    totalDistance: stats.totalDistance + distance,
    bestDistance: Math.max(stats.bestDistance, distance),
    bestNearMisses: Math.max(stats.bestNearMisses, nearMisses),
    bestScore: Math.max(stats.bestScore, score),
    bestLevel: Math.max(stats.bestLevel, level),
    totalNearMisses: stats.totalNearMisses + nearMisses,
    totalPowerups: stats.totalPowerups + powerups,
    totalCoins: stats.totalCoins + coins,
    challengesPlayed: stats.challengesPlayed + (isChallenge ? 1 : 0),
    dailyPodiums: stats.dailyPodiums,
    weeklyPodiums: stats.weeklyPodiums,
    bestChallengeScore: isChallenge
      ? Math.max(stats.bestChallengeScore, score)
      : stats.bestChallengeScore,
    daysPlayed: stats.daysPlayed + (isNewDay ? 1 : 0),
    lastPlayDay: isNewDay ? Math.max(day, stats.lastPlayDay) : stats.lastPlayDay,
  };
}

/** Dobra UM pódio (top-3) do modo dado. Imutável. */
export function foldPodium(stats: TrophyStats, mode: 'daily' | 'weekly'): TrophyStats {
  return mode === 'daily'
    ? { ...stats, dailyPodiums: stats.dailyPodiums + 1 }
    : { ...stats, weeklyPodiums: stats.weeklyPodiums + 1 };
}

/** Desbloqueia toda conquista satisfeita e ainda-não-desbloqueada. Mesmo objeto se nada muda. */
export function evaluate(
  state: TrophyState, ctx: TrophyEvalContext,
): { state: TrophyState; newlyUnlocked: readonly string[] } {
  const newlyUnlocked: string[] = [];
  for (const def of TROPHY_CATALOG) {
    if (!state.unlocked.includes(def.id) && def.condition(ctx)) {
      newlyUnlocked.push(def.id);
    }
  }
  if (newlyUnlocked.length === 0) return { state, newlyUnlocked };
  return { state: { ...state, unlocked: [...state.unlocked, ...newlyUnlocked] }, newlyUnlocked };
}

/**
 * Dobra a partida, dobra o pódio (se houver rank de pódio) e reavalia. Imutável.
 *
 * INVARIANTE: `dailyRank` e o caminho assíncrono `TrophyService.recordDailyPodium` contam o MESMO
 * pódio. `startGame` computa o rank local só quando o board central está indisponível, e usa o
 * central só quando está — nunca os dois para a mesma partida.
 */
export function recordMatch(
  state: TrophyState,
  m: MatchSummary,
  extra?: { readonly dailyRank?: number; readonly weeklyRank?: number },
): { state: TrophyState; newlyUnlocked: readonly string[] } {
  let stats = foldMatch(state.stats, m);
  if (extra?.dailyRank !== undefined && extra.dailyRank <= PODIUM_RANK) {
    stats = foldPodium(stats, 'daily');
  }
  if (extra?.weeklyRank !== undefined && extra.weeklyRank <= PODIUM_RANK) {
    stats = foldPodium(stats, 'weekly');
  }
  const ctx: TrophyEvalContext = {
    stats,
    ...(extra?.dailyRank !== undefined ? { dailyRank: extra.dailyRank } : {}),
    ...(extra?.weeklyRank !== undefined ? { weeklyRank: extra.weeklyRank } : {}),
  };
  return evaluate({ stats, unlocked: state.unlocked }, ctx);
}
