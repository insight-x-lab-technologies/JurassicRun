import type { TrophyStats } from './store';

/** Uma conquista: predicado puro sobre o agregado vitalício. Ícone = emoji na UI. */
export interface TrophyDef {
  readonly id: string;
  readonly nameKey: string;
  readonly descKey: string;
  readonly condition: (s: TrophyStats) => boolean;
}

/** Catálogo inicial. Limiares são placeholders (tuning Fase 8). */
export const TROPHY_CATALOG: readonly TrophyDef[] = Object.freeze([
  { id: 'firstFlight', nameKey: 'trophy.firstFlight.name', descKey: 'trophy.firstFlight.desc',
    condition: (s) => s.gamesPlayed >= 1 },
  { id: 'centurion', nameKey: 'trophy.centurion.name', descKey: 'trophy.centurion.desc',
    condition: (s) => s.bestDistance >= 1000 },
  { id: 'forager', nameKey: 'trophy.forager.name', descKey: 'trophy.forager.desc',
    condition: (s) => s.totalFood >= 50 },
  { id: 'daredevil', nameKey: 'trophy.daredevil.name', descKey: 'trophy.daredevil.desc',
    condition: (s) => s.bestNearMisses >= 10 },
  { id: 'marathoner', nameKey: 'trophy.marathoner.name', descKey: 'trophy.marathoner.desc',
    condition: (s) => s.totalDistance >= 10000 },
  { id: 'highRoller', nameKey: 'trophy.highRoller.name', descKey: 'trophy.highRoller.desc',
    condition: (s) => s.bestScore >= 5000 },
  { id: 'persistent', nameKey: 'trophy.persistent.name', descKey: 'trophy.persistent.desc',
    condition: (s) => s.gamesPlayed >= 25 },
]);

export function trophyById(id: string): TrophyDef | undefined {
  return TROPHY_CATALOG.find((t) => t.id === id);
}
