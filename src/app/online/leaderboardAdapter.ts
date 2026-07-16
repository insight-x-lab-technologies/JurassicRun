import { onlineService } from '@services/online';
import { dailyChallengeSeed, weeklyChallengeSeed } from '@render/seedSource';
import type { LeaderboardOnline } from '@services/leaderboard/online';
import type { LeaderboardMode, LeaderboardResult } from '@services/leaderboard';
import type { OnlineScoreRow } from '@services/online/client';

interface OnlineScoresLike {
  readonly online: { readonly value: boolean };
  submitScore(input: {
    mode: LeaderboardMode; seed: string; score: number; distance: number;
    food: number; nearMisses: number; level: number;
  }): Promise<void>;
  fetchScores(mode: LeaderboardMode, seed?: string): Promise<readonly OnlineScoreRow[]>;
}

export function createLeaderboardOnline(deps: {
  onlineSvc?: OnlineScoresLike;
  dailySeed?: () => string;
  weeklySeed?: () => string;
} = {}): LeaderboardOnline {
  const svc = (deps.onlineSvc ?? onlineService) as OnlineScoresLike;
  const dailySeed = deps.dailySeed ?? dailyChallengeSeed;
  const weeklySeed = deps.weeklySeed ?? weeklyChallengeSeed;
  return {
    online: svc.online as LeaderboardOnline['online'],
    async submitScore(r: LeaderboardResult) {
      await svc.submitScore({
        mode: r.mode, seed: r.seed, score: r.score, distance: r.distance,
        food: r.food, nearMisses: r.nearMisses, level: r.level,
      });
    },
    fetchScores(mode, seed) {
      return svc.fetchScores(mode, seed);
    },
    currentSeeds() {
      return { daily: dailySeed(), weekly: weeklySeed() };
    },
  };
}
