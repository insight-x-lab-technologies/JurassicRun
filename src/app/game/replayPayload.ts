import { hashState } from '@core/replay';
import type { InputTimeline } from '@core/replay';
import type { WorldState } from '@core/sim';
import type { MatchMode } from '@render/matchFactory';
import type { StoredReplay } from '@services/replay';

/**
 * Monta o payload de replay verificável para uma partida de desafio (daily/weekly).
 * Retorna null para endless (fora do escopo do 5.4 — trait aleatório não reconstrutível só da seed).
 * Puro/testável sem Phaser. O `finalHash` ancora a integridade: verifyReplay re-simula
 * {seed, trait:'none'} + timeline e compara este hash.
 */
export function buildReplayPayload(
  mode: MatchMode,
  seedLabel: string,
  world: WorldState,
  timeline: InputTimeline,
  achievedAt: number,
): StoredReplay | null {
  if (mode !== 'daily' && mode !== 'weekly') return null;
  return {
    mode,
    seed: seedLabel,
    timeline: timeline.map((f) => f.flap),
    score: world.score,
    distance: world.distance,
    food: world.food,
    nearMisses: world.nearMisses,
    finalHash: hashState(world),
    achievedAt,
  };
}
