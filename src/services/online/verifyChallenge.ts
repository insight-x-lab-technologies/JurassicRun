import { simulate, hashState } from '@core/replay';
import type { InputTimeline } from '@core/replay';

/** Submissão de desafio a verificar (Diário/Semanal). challenge_entries não tem `level`. */
export interface ChallengeSubmission {
  readonly seed: string;
  readonly timeline: readonly boolean[]; // 1 flap por step
  readonly score: number;
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly finalHash: string;
}

export interface ChallengeVerification {
  readonly valid: boolean;
  readonly expectedHash: string; // hash recomputado pela re-sim
  readonly hashMatches: boolean; // timeline reproduz o estado final declarado
  readonly fieldsMatch: boolean; // colunas de score batem com a re-sim
}

/**
 * Re-simula {seed, trait:'none'} + timeline e valida integridade. Único ponto da verdade do
 * anti-cheat, importado tanto pelo Vitest quanto pela Edge Function (via bundle). Puro:
 * depende só de @core/replay. hashMatches prova a timeline; fieldsMatch prova que as colunas
 * não foram infladas independentemente do hash. Ambos são necessários.
 */
export function verifyChallengeSubmission(sub: ChallengeSubmission): ChallengeVerification {
  const timeline: InputTimeline = sub.timeline.map((flap) => ({ flap }));
  const world = simulate({ seed: sub.seed, trait: 'none' }, timeline);
  const expectedHash = hashState(world);
  const hashMatches = expectedHash === sub.finalHash;
  const fieldsMatch =
    world.score === sub.score &&
    world.distance === sub.distance &&
    world.food === sub.food &&
    world.nearMisses === sub.nearMisses;
  return { valid: hashMatches && fieldsMatch, expectedHash, hashMatches, fieldsMatch };
}
