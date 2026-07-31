import { createWorld } from '@core/sim';
import type { DinoTrait } from '@core/dino';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { MatchController, type MatchPhase } from '@render/match';
import { createMatchFactory, type MatchMode } from '@render/matchFactory';
import { randomEndlessSeed, dailyChallengeSeed, weeklyChallengeSeed } from '@render/seedSource';
import { bindGameControls } from '@render/controls';
import { effectViews, type EffectView } from '@render/effects';
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

/** Stats vivos do mundo para o HUD DOM (W4 + 9.5). Lidos do WorldState corrente. */
export interface HudLive {
  readonly distance: number;
  readonly food: number;
  readonly level: number;
  readonly speed: number;
  readonly weather: string;
  readonly seed: string;
  /** Efeitos temporários ativos, na ordem canônica (9.5). */
  readonly effects: readonly EffectView[];
  /** Cargas de vida extra (não é efeito temporário). */
  readonly extraLives: number;
  /** Traço da PARTIDA (`world.trait`) — nos desafios é sempre 'none'. */
  readonly trait: DinoTrait;
}

export interface MatchSnapshot {
  readonly phase: MatchPhase;
  readonly paused: boolean;
  readonly gameOver: GameOverStats | null;
  /** 9.3: true durante a animação cosmética de morte — o overlay de Game Over espera ela acabar. */
  readonly dying: boolean;
}

export interface GameHandle {
  readonly stop: () => void;
  readonly snapshot: () => MatchSnapshot;
  /** Payload do HUD (9.5): chamado só no throttle de ~5 Hz, não por frame. */
  readonly hud: () => HudLive | null;
  readonly restart: () => void;
}

/**
 * Monta o jogo Phaser no `container` no `mode` dado (endless por default) e devolve um
 * `GameHandle` ({stop, snapshot, hud, restart}) que a casca Preact usa para controlar/ler a
 * partida.
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
      // DIÁRIO: o rank LOCAL só é usado quando o board central está indisponível; quando está, o
      // pódio vem do `centralDailyRank` abaixo. Os dois caminhos dobram o MESMO contador de
      // pódio — por isso são mutuamente exclusivos (ver TrophyService.recordDailyPodium).
      const localDailyRank =
        mode === 'daily' && !online
          ? leaderboardService.dailyRankForSeed(match.seedLabel)
          : undefined;
      // SEMANAL: sempre usa o rank LOCAL, online ou não — a Fase 6 só implementou board central
      // DIÁRIO (`leaderboardService.centralDailyRank`); não existe `centralWeeklyRank` hoje.
      // Se um rank central semanal for adicionado no futuro, ele precisará da MESMA guarda de
      // exclusividade mútua que o diário tem acima, senão `weeklyPodiums` conta em dobro.
      const localWeeklyRank =
        mode === 'weekly' ? leaderboardService.weeklyRankForSeed(match.seedLabel) : undefined;
      trophyService.recordMatch(
        {
          distance: w.distance,
          food: w.food,
          nearMisses: w.nearMisses,
          score: w.score,
          level: w.level,
          coins: coinsForFood(w.food),
          powerups: match.powerupsCollected,
          mode,
          playedAt: result.achievedAt,
        },
        localDailyRank !== undefined || localWeeklyRank !== undefined
          ? {
              ...(localDailyRank !== undefined ? { dailyRank: localDailyRank } : {}),
              ...(localWeeklyRank !== undefined ? { weeklyRank: localWeeklyRank } : {}),
            }
          : undefined,
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
    // 9.3: durante `dying` o restart de teclado/toque não deve pular a animação de impacto.
    isDead: () => match.phase === 'dead' && !match.dying,
  });

  const stop = () => {
    cleanupControls();
    game.destroy(true);
  };
  const hudLive = (): HudLive | null => {
    if (match.phase !== 'playing') return null;
    const w = match.world;
    return {
      distance: w.distance, food: w.food, level: w.level,
      speed: w.scrollSpeed, weather: w.weather, seed: match.seedLabel,
      effects: effectViews(w.effects), extraLives: w.extraLives, trait: w.trait,
    };
  };
  return {
    stop,
    snapshot: () => ({
      phase: match.phase,
      paused: pause.paused,
      gameOver: lastGameOver,
      dying: match.dying,
    }),
    hud: hudLive,
    restart: () => match.restart(),
  };
}
