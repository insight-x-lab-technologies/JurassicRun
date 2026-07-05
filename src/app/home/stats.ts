import { walletService } from '@services/wallet';

/**
 * Stats agregados exibidos na barra de topo da Home.
 *
 * `coins` vem da carteira persistente real (item 4.5, `walletService`).
 * `trophies` (4.7) e `maxLevel` Endless (Fase 5) ainda são placeholders — este
 * é o ÚNICO ponto a religar quando esses serviços chegarem.
 */
export interface HomeStats {
  readonly coins: number;
  readonly trophies: number;
  readonly maxLevel: number;
}

export function getHomeStats(): HomeStats {
  return { coins: walletService.balance.value, trophies: 0, maxLevel: 1 };
}
