import type { WorldConfig, WorldState } from '@core/sim';
import type { DinoTrait } from '@core/dino';
import { challengeWorldConfig } from '@core/challenge';
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
 * - endless: nova seed aleatória por (re)start; trait = dino ativo; `challenge` fica `undefined`.
 * - daily/weekly: seed do desafio capturada 1× aqui (restart replaya a mesma); config canônica
 *   via `challengeWorldConfig` — trait forçado a 'none' e `challenge: true`, que faz `createWorld`
 *   derivar os modificadores (clima fixo, catálogo de power-up sem o banido) da própria seed.
 *   Esta é a MESMA config usada por `verifyReplay` e pela Edge Function anti-cheat: se divergirem,
 *   um replay honesto é rejeitado.
 */
export function createMatchFactory(mode: MatchMode, deps: MatchFactoryDeps): () => MatchInit {
  if (mode === 'endless') {
    return () => {
      const seedLabel = deps.randomEndlessSeed();
      return { world: deps.createWorld({ seed: seedLabel, trait: deps.activeTrait() }), seedLabel };
    };
  }
  const seedLabel = mode === 'daily' ? deps.dailyChallengeSeed() : deps.weeklyChallengeSeed();
  return () => ({ world: deps.createWorld(challengeWorldConfig(seedLabel)), seedLabel });
}
