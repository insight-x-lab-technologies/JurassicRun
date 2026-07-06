import { walletService } from '@services/wallet';
import { trophyService } from '@services/trophy';

/**
 * Stats agregados exibidos na barra de topo da Home.
 *
 * `coins` vem da carteira persistente real (item 4.5, `walletService`). `trophies` vem
 * do `trophyService` (item 4.7). `maxLevel` Endless ainda é placeholder — religa na
 * Fase 5 (leaderboards).
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
    maxLevel: 1,
  };
}
