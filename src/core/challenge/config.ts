import type { WorldConfig } from '@core/sim';

/**
 * Config canônica de uma partida de desafio (Diário/Semanal). FONTE DA VERDADE única: a fábrica
 * de partidas, o verificador de replay local e a Edge Function anti-cheat usam esta função — se
 * divergirem, um replay honesto é rejeitado.
 *
 * `trait: 'none'` mantém a corrida justa; `challenge: true` faz `createWorld` derivar os
 * modificadores da própria seed.
 */
export function challengeWorldConfig(seed: string): WorldConfig {
  return { seed, trait: 'none', challenge: true };
}
