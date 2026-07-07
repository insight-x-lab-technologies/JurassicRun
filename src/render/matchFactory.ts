import type { WorldConfig, WorldState } from '@core/sim';
import type { DinoTrait } from '@core/dino';
import type { MatchInit } from './match';

export type MatchMode = 'endless' | 'daily' | 'weekly';

export interface MatchFactoryDeps {
  /** Casca: novo seed Endless aleatório por chamada. */
  randomEndlessSeed: () => string;
  /** Casca: seed do Desafio Diário de hoje (UTC). */
  dailyChallengeSeed: () => string;
  /** Casca: seed do Desafio Semanal desta semana (UTC). */
  weeklyChallengeSeed: () => string;
  /** Trait do dino ativo do Ninho (usado só no Endless). */
  activeTrait: () => DinoTrait;
  createWorld: (config: WorldConfig) => WorldState;
}

/**
 * Fábrica de `MatchInit` por modo (PURA dado `deps`).
 * - endless: nova seed aleatória por (re)start; trait = dino ativo.
 * - daily/weekly: seed do desafio capturada 1× aqui (restart replaya a mesma);
 *   trait forçado a 'none' (corrida justa e reproduzível só por seed+inputs).
 */
export function createMatchFactory(mode: MatchMode, deps: MatchFactoryDeps): () => MatchInit {
  if (mode === 'endless') {
    return () => {
      const seedLabel = deps.randomEndlessSeed();
      return { world: deps.createWorld({ seed: seedLabel, trait: deps.activeTrait() }), seedLabel };
    };
  }
  const seedLabel = mode === 'daily' ? deps.dailyChallengeSeed() : deps.weeklyChallengeSeed();
  return () => ({ world: deps.createWorld({ seed: seedLabel, trait: 'none' }), seedLabel });
}
