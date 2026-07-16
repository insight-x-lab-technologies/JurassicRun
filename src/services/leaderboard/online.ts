import { signal, type ReadonlySignal } from '@preact/signals';
import type { LeaderboardMode, LeaderboardResult } from './store';
import type { OnlineScoreRow } from '@services/online/client';

export interface LeaderboardOnline {
  readonly online: ReadonlySignal<boolean>;
  readonly playerId: ReadonlySignal<string | null>;
  submitScore(input: LeaderboardResult): Promise<void>;
  fetchScores(mode: LeaderboardMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
  fetchVerifiedPlayers(mode: LeaderboardMode, seed: string): Promise<readonly string[]>;
  currentSeeds(): { readonly daily: string; readonly weekly: string };
}

export interface MemoryLeaderboardOnline extends LeaderboardOnline {
  readonly submitted: LeaderboardResult[];
  setOnline(v: boolean): void;
}

export function memoryLeaderboardOnline(opts: {
  online?: boolean;
  playerId?: string | null;
  rows?: Partial<Record<LeaderboardMode, readonly OnlineScoreRow[]>>;
  seeds?: { daily: string; weekly: string };
  verified?: Partial<Record<LeaderboardMode, readonly string[]>>;
} = {}): MemoryLeaderboardOnline {
  const _online = signal(opts.online ?? false);
  const submitted: LeaderboardResult[] = [];
  return {
    online: _online,
    playerId: signal(opts.playerId ?? null),
    submitted,
    setOnline(v) {
      _online.value = v;
    },
    async submitScore(input) {
      submitted.push(input);
    },
    async fetchScores(mode) {
      return opts.rows?.[mode] ?? [];
    },
    async fetchVerifiedPlayers(mode) {
      return opts.verified?.[mode] ?? [];
    },
    currentSeeds() {
      return opts.seeds ?? { daily: 'daily:x', weekly: 'weekly:x' };
    },
  };
}
