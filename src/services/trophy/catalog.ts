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

/**
 * Catálogo de conquistas (23 — item 10.7).
 * Limiares ancorados nos números reais do jogo: nível = 1 + floor(distância/500)
 * (`DISTANCE_PER_LEVEL`), score = distância + 10·comida + 5·near-miss
 * (`src/core/economy/constants.ts`), e os 8 troféus originais como degrau de baixo da escada.
 */
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

  // ── 10.7: progressão de corrida ──────────────────────────────────────────
  { id: 'explorer', nameKey: 'trophy.explorer.name', descKey: 'trophy.explorer.desc',
    condition: (c) => c.stats.bestLevel >= 5 },            // 2000 de distância
  { id: 'skyLord', nameKey: 'trophy.skyLord.name', descKey: 'trophy.skyLord.desc',
    condition: (c) => c.stats.bestLevel >= 10 },           // 4500 de distância
  { id: 'globetrotter', nameKey: 'trophy.globetrotter.name', descKey: 'trophy.globetrotter.desc',
    condition: (c) => c.stats.totalDistance >= 50_000 },   // 5× marathoner
  { id: 'legend', nameKey: 'trophy.legend.name', descKey: 'trophy.legend.desc',
    condition: (c) => c.stats.bestScore >= 20_000 },       // 4× highRoller

  // ── 10.7: volume e perícia ───────────────────────────────────────────────
  { id: 'veteran', nameKey: 'trophy.veteran.name', descKey: 'trophy.veteran.desc',
    condition: (c) => c.stats.gamesPlayed >= 100 },        // 4× persistent
  { id: 'stuntPilot', nameKey: 'trophy.stuntPilot.name', descKey: 'trophy.stuntPilot.desc',
    condition: (c) => c.stats.bestNearMisses >= 25 },      // 2,5× daredevil
  { id: 'closeShave', nameKey: 'trophy.closeShave.name', descKey: 'trophy.closeShave.desc',
    condition: (c) => c.stats.totalNearMisses >= 250 },

  // ── 10.7: economia ───────────────────────────────────────────────────────
  { id: 'treasurer', nameKey: 'trophy.treasurer.name', descKey: 'trophy.treasurer.desc',
    condition: (c) => c.stats.totalCoins >= 500 },         // 10× forager
  { id: 'tycoon', nameKey: 'trophy.tycoon.name', descKey: 'trophy.tycoon.desc',
    condition: (c) => c.stats.totalCoins >= 5_000 },

  // ── 10.7: power-ups ──────────────────────────────────────────────────────
  { id: 'empowered', nameKey: 'trophy.empowered.name', descKey: 'trophy.empowered.desc',
    condition: (c) => c.stats.totalPowerups >= 25 },
  { id: 'powerHungry', nameKey: 'trophy.powerHungry.name', descKey: 'trophy.powerHungry.desc',
    condition: (c) => c.stats.totalPowerups >= 200 },

  // ── 10.7: desafios ───────────────────────────────────────────────────────
  { id: 'challenger', nameKey: 'trophy.challenger.name', descKey: 'trophy.challenger.desc',
    condition: (c) => c.stats.challengesPlayed >= 10 },
  { id: 'challengeAce', nameKey: 'trophy.challengeAce.name', descKey: 'trophy.challengeAce.desc',
    condition: (c) => c.stats.bestChallengeScore >= 5_000 },
  // Par do `dailyPodium`, mas sobre o AGREGADO: assim continua desbloqueável numa avaliação
  // posterior, sem depender de o rank estar no contexto daquele instante.
  { id: 'weeklyPodium', nameKey: 'trophy.weeklyPodium.name', descKey: 'trophy.weeklyPodium.desc',
    condition: (c) => c.stats.weeklyPodiums >= 1 },

  // ── 10.7: constância ─────────────────────────────────────────────────────
  { id: 'dedicated', nameKey: 'trophy.dedicated.name', descKey: 'trophy.dedicated.desc',
    condition: (c) => c.stats.daysPlayed >= 7 },
]);

export function trophyById(id: string): TrophyDef | undefined {
  return TROPHY_CATALOG.find((t) => t.id === id);
}

export function isKnownTrophyId(id: string): boolean {
  return TROPHY_CATALOG.some((t) => t.id === id);
}
