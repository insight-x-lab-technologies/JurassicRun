import type { OnlineScoreRow } from '@services/online/client';
import { MAX_ENTRIES, sanitizeStat } from './store';

export interface CentralEntry {
  readonly playerId: string;
  readonly playerName: string;
  readonly playerAvatar: string;
  readonly seed: string;
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly createdAt: number;
  readonly verified: boolean;
}

function entryOf(r: OnlineScoreRow): CentralEntry {
  return {
    playerId: r.playerId,
    playerName: r.playerName,
    playerAvatar: r.playerAvatar,
    seed: r.seed,
    score: sanitizeStat(r.score),
    distance: sanitizeStat(r.distance),
    food: sanitizeStat(r.food),
    nearMisses: sanitizeStat(r.nearMisses),
    createdAt: Number.isFinite(r.createdAt) ? r.createdAt : 0,
    verified: false,
  };
}

/** Dedup por jogador (melhor score), ordena por score desc, corta top-N. Puro. */
export function toCentralEntries(
  rows: readonly OnlineScoreRow[],
  maxEntries: number = MAX_ENTRIES,
): readonly CentralEntry[] {
  const best = new Map<string, CentralEntry>();
  for (const raw of rows) {
    const e = entryOf(raw);
    const prev = best.get(e.playerId);
    if (prev === undefined || e.score > prev.score) best.set(e.playerId, e);
  }
  return [...best.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
    })
    .slice(0, maxEntries);
}
