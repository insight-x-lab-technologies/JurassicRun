import type { TrophyEvalContext } from './store';

/** Uma conquista: predicado puro sobre o contexto de avaliação. Ícone = emoji na UI. */
export interface TrophyDef {
  readonly id: string;
  readonly nameKey: string;
  readonly descKey: string;
  readonly condition: (ctx: TrophyEvalContext) => boolean;
}

/** Rank máximo (inclusivo) que conta como pódio do Desafio Diário local. */
export const PODIUM_RANK = 3;

/** Catálogo inicial. Limiares são placeholders (tuning Fase 8). */
export const TROPHY_CATALOG: readonly TrophyDef[] = Object.freeze([
  { id: 'firstFlight', nameKey: 'trophy.firstFlight.name', descKey: 'trophy.firstFlight.desc',
    condition: (c) => c.stats.gamesPlayed >= 1 },
  { id: 'centurion', nameKey: 'trophy.centurion.name', descKey: 'trophy.centurion.desc',
    condition: (c) => c.stats.bestDistance >= 1000 },
  { id: 'forager', nameKey: 'trophy.forager.name', descKey: 'trophy.forager.desc',
    condition: (c) => c.stats.totalFood >= 50 },
  { id: 'daredevil', nameKey: 'trophy.daredevil.name', descKey: 'trophy.daredevil.desc',
    condition: (c) => c.stats.bestNearMisses >= 10 },
  { id: 'marathoner', nameKey: 'trophy.marathoner.name', descKey: 'trophy.marathoner.desc',
    condition: (c) => c.stats.totalDistance >= 10000 },
  { id: 'highRoller', nameKey: 'trophy.highRoller.name', descKey: 'trophy.highRoller.desc',
    condition: (c) => c.stats.bestScore >= 5000 },
  { id: 'persistent', nameKey: 'trophy.persistent.name', descKey: 'trophy.persistent.desc',
    condition: (c) => c.stats.gamesPlayed >= 25 },
  { id: 'dailyPodium', nameKey: 'trophy.dailyPodium.name', descKey: 'trophy.dailyPodium.desc',
    condition: (c) => c.dailyRank !== undefined && c.dailyRank <= PODIUM_RANK },
]);

export function trophyById(id: string): TrophyDef | undefined {
  return TROPHY_CATALOG.find((t) => t.id === id);
}
