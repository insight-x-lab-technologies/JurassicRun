/**
 * Stats agregados exibidos na barra de topo da Home.
 *
 * SEAM: as fontes reais ainda não existem — carteira de moedas e nível máx
 * Endless vêm do item 4.5 (economia persistente) e troféus do 4.7. Este é o
 * ÚNICO ponto a religar quando esses serviços chegarem. Puro e determinístico.
 */
export interface HomeStats {
  readonly coins: number;
  readonly trophies: number;
  readonly maxLevel: number;
}

export function getHomeStats(): HomeStats {
  return { coins: 0, trophies: 0, maxLevel: 1 };
}
