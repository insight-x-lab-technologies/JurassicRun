import { simulate, hashState } from '@core/replay';
import type { InputTimeline } from '@core/replay';
import type { StoredReplay } from './store';

/** Resultado da verificação de integridade de um replay. */
export interface ReplayVerification {
  readonly valid: boolean;
  readonly expectedHash: string; // gravado no replay
  readonly actualHash: string; // recomputado re-simulando seed + timeline
}

/**
 * Re-simula um replay de desafio ({seed, trait:'none'} — dificuldade/clima nos defaults, DEVE
 * bater com createMatchFactory) e compara o hash do estado final com a âncora gravada.
 * Este é o seam da verificação online da Fase 6 (o servidor fará o mesmo com o dado submetido).
 */
export function verifyReplay(replay: StoredReplay): ReplayVerification {
  const timeline: InputTimeline = replay.timeline.map((flap) => ({ flap }));
  const world = simulate({ seed: replay.seed, trait: 'none' }, timeline);
  const actualHash = hashState(world);
  return {
    valid: actualHash === replay.finalHash,
    expectedHash: replay.finalHash,
    actualHash,
  };
}
