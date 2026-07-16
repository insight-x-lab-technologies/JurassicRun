import { createWorld } from '@core/sim';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { MatchController } from '@render/match';
import { createMatchFactory, type MatchMode } from '@render/matchFactory';
import { randomEndlessSeed, dailyChallengeSeed, weeklyChallengeSeed } from '@render/seedSource';
import { bindGameControls } from '@render/controls';
import { nestService } from '@services/nest';
import { walletService, coinsForFood } from '@services/wallet';
import { trophyService } from '@services/trophy';
import { leaderboardService } from '@services/leaderboard';
import { replayService } from '@services/replay';
import { onlineService } from '@services/online';
import { buildReplayPayload } from './replayPayload';

/**
 * Monta o jogo Phaser no `container` no `mode` dado (endless por default) e devolve um
 * `stop()` que o destrói e remove os listeners.
 */
export function startGame(container: HTMLElement, mode: MatchMode = 'endless'): () => void {
  const flap = new FlapInputSource();
  const pause = new PauseController();
  pause.onPause = () => flap.reset();

  const factory = createMatchFactory(mode, {
    randomEndlessSeed,
    dailyChallengeSeed,
    weeklyChallengeSeed,
    activeTrait: () => nestService.activeTrait(),
    createWorld,
  });

  const match = new MatchController(flap, factory, {
    onNewMatch: () => flap.reset(),
    onGameOver: (w) => {
      walletService.earn(coinsForFood(w.food));

      const result = {
        mode,
        seed: match.seedLabel,
        score: w.score,
        distance: w.distance,
        food: w.food,
        nearMisses: w.nearMisses,
        level: w.level,
        achievedAt: Date.now(),
      };
      leaderboardService.recordMatch(result);

      const online = leaderboardService.centralAvailable.value;
      const localRank =
        mode === 'daily' && !online
          ? leaderboardService.dailyRankForSeed(match.seedLabel)
          : undefined;
      trophyService.recordMatch(
        { distance: w.distance, food: w.food, nearMisses: w.nearMisses, score: w.score },
        localRank !== undefined ? { dailyRank: localRank } : undefined,
      );
      if (mode === 'daily' && online) {
        void leaderboardService
          .centralDailyRank(result)
          .then((rank) => {
            if (rank !== undefined) trophyService.recordDailyPodium(rank);
          })
          .catch(() => {});
      }

      const replay = buildReplayPayload(
        mode,
        match.seedLabel,
        w,
        match.recordedTimeline(),
        Date.now(),
      );
      if (replay) replayService.record(replay);
      if (replay && (mode === 'daily' || mode === 'weekly')) {
        void onlineService.submitChallengeEntry({
          mode,
          seed: replay.seed,
          score: replay.score,
          distance: replay.distance,
          food: replay.food,
          nearMisses: replay.nearMisses,
          timeline: replay.timeline,
          finalHash: replay.finalHash,
        });
      }
    },
  });

  const game = createGame(container, match, { pause });
  const cleanupControls = bindGameControls(window, {
    flap,
    pause,
    onFlap: () => match.notifyFlap(),
    onRestart: () => match.restart(),
    isDead: () => match.phase === 'dead',
  });

  return () => {
    cleanupControls();
    game.destroy(true);
  };
}
