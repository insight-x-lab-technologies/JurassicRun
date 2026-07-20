import { createWorld } from '@core/sim';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { MatchController, type MatchPhase } from '@render/match';
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

export interface GameOverStats {
  readonly distance: number;
  readonly food: number;
  readonly nearMisses: number;
  readonly score: number;
  readonly coins: number;
  readonly newRecord: boolean;
}

/** Stats vivos do mundo para o HUD DOM (W4). Lidos do WorldState corrente. */
export interface HudLive {
  readonly distance: number;
  readonly food: number;
  readonly level: number;
  readonly speed: number;
  readonly weather: string;
  readonly seed: string;
}

export interface MatchSnapshot {
  readonly phase: MatchPhase;
  readonly paused: boolean;
  readonly gameOver: GameOverStats | null;
  readonly hud: HudLive | null;
}

export interface GameHandle {
  readonly stop: () => void;
  readonly snapshot: () => MatchSnapshot;
  readonly restart: () => void;
}

/**
 * Monta o jogo Phaser no `container` no `mode` dado (endless por default) e devolve um
 * `GameHandle` ({stop, snapshot, restart}) que a casca Preact usa para controlar/ler a partida.
 */
export function startGame(container: HTMLElement, mode: MatchMode = 'endless'): GameHandle {
  const flap = new FlapInputSource();
  const pause = new PauseController();
  pause.onPause = () => flap.reset();

  let lastGameOver: GameOverStats | null = null;

  const factory = createMatchFactory(mode, {
    randomEndlessSeed,
    dailyChallengeSeed,
    weeklyChallengeSeed,
    activeTrait: () => nestService.activeTrait(),
    createWorld,
  });

  const match = new MatchController(flap, factory, {
    onNewMatch: () => {
      flap.reset();
      lastGameOver = null;
    },
    onGameOver: (w) => {
      const listFor =
        mode === 'daily' ? leaderboardService.daily
        : mode === 'weekly' ? leaderboardService.weekly
        : leaderboardService.endless;
      const prevBest = listFor.value[0]?.score ?? -1;
      lastGameOver = {
        distance: w.distance,
        food: w.food,
        nearMisses: w.nearMisses,
        score: w.score,
        coins: coinsForFood(w.food),
        newRecord: w.score > prevBest,
      };

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

  const stop = () => {
    cleanupControls();
    game.destroy(true);
  };
  const hudLive = (): HudLive => {
    const w = match.world;
    return {
      distance: w.distance, food: w.food, level: w.level,
      speed: w.scrollSpeed, weather: w.weather, seed: match.seedLabel,
    };
  };
  return {
    stop,
    snapshot: () => ({
      phase: match.phase,
      paused: pause.paused,
      gameOver: lastGameOver,
      hud: match.phase === 'playing' ? hudLive() : null,
    }),
    restart: () => match.restart(),
  };
}
