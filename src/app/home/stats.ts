import { walletService } from '@services/wallet';
import { trophyService } from '@services/trophy';
import { leaderboardService } from '@services/leaderboard';

/**
 * Stats agregados exibidos na barra de topo da Home.
 *
 * `coins` vem da carteira persistente real (item 4.5, `walletService`). `trophies` vem
 * do `trophyService` (item 4.7). `maxLevel` vem do `leaderboardService.bestEndlessLevel`
 * (item 5.2).
 */
export interface HomeStats {
  readonly coins: number;
  readonly trophies: number;
  readonly maxLevel: number;
}

export function getHomeStats(): HomeStats {
  return {
    coins: walletService.balance.value,
    trophies: trophyService.unlockedCount.value,
    maxLevel: leaderboardService.bestEndlessLevel.value,
  };
}
