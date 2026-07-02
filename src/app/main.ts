import { i18n } from '@services/i18n';
import { createWorld } from '@core/sim';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { MatchController } from '@render/match';
import { randomEndlessSeed } from '@render/seedSource';
import { bindGameControls } from '@render/controls';

async function bootstrap(): Promise<void> {
  await i18n.init();
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t('app.title');

  const flap = new FlapInputSource();
  const pause = new PauseController();
  pause.onPause = () => flap.reset(); // anti-flap-fantasma ao pausar

  // Cada partida nasce com uma seed Endless aleatória (fora do core), exibida no HUD.
  const match = new MatchController(
    flap,
    () => {
      const seed = randomEndlessSeed();
      return { world: createWorld({ seed }), seedLabel: seed };
    },
    { onNewMatch: () => flap.reset() }, // tap de restart não vira o 1º flap
  );

  createGame('app', match, { pause });
  bindGameControls(window, {
    flap,
    pause,
    onFlap: () => match.notifyFlap(),
    onRestart: () => match.restart(),
    isDead: () => match.phase === 'dead',
  });
}

void bootstrap();
