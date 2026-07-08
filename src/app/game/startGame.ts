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
      leaderboardService.recordMatch({
        mode,
        seed: match.seedLabel,
        score: w.score,
        distance: w.distance,
        food: w.food,
        nearMisses: w.nearMisses,
        level: w.level,
        achievedAt: Date.now(),
      });
      const dailyRank =
        mode === 'daily' ? leaderboardService.dailyRankForSeed(match.seedLabel) : undefined;
      trophyService.recordMatch(
        { distance: w.distance, food: w.food, nearMisses: w.nearMisses, score: w.score },
        dailyRank !== undefined ? { dailyRank } : undefined,
      );
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
