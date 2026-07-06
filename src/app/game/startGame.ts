import { createWorld } from '@core/sim';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { MatchController } from '@render/match';
import { randomEndlessSeed } from '@render/seedSource';
import { bindGameControls } from '@render/controls';
import { nestService } from '@services/nest';
import { walletService, coinsForFood } from '@services/wallet';
import { trophyService } from '@services/trophy';

/**
 * Monta o jogo Phaser no `container` e devolve um `stop()` que o destrói e remove os
 * listeners. Reproduz a fiação antes feita no main.ts (agora dirigida pela PlayScreen).
 */
export function startGame(container: HTMLElement): () => void {
  const flap = new FlapInputSource();
  const pause = new PauseController();
  pause.onPause = () => flap.reset();

  const match = new MatchController(
    flap,
    () => {
      const seed = randomEndlessSeed();
      return { world: createWorld({ seed, trait: nestService.activeTrait() }), seedLabel: seed };
    },
    {
      onNewMatch: () => flap.reset(),
      onGameOver: (w) => {
        walletService.earn(coinsForFood(w.food));
        trophyService.recordMatch({
          distance: w.distance,
          food: w.food,
          nearMisses: w.nearMisses,
          score: w.score,
        });
      },
    },
  );

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
