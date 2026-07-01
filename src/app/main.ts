import { i18n } from '@services/i18n';
import { createWorld } from '@core/sim';
import { createGame } from '@render/game';
import { FlapInputSource, PauseController } from '@render/input';
import { bindGameControls } from '@render/controls';

async function bootstrap(): Promise<void> {
  await i18n.init();
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t('app.title');

  // Mundo de demonstração para o vertical slice (seed aleatória/fluxo real é 2.5).
  // O shell Preact de telas entra na Fase 4; em 2.1 o canvas ocupa a tela.
  const world = createWorld({ seed: 'endless:DEMO' });
  const flap = new FlapInputSource();
  const pause = new PauseController();
  pause.onPause = () => flap.reset(); // anti-flap-fantasma ao pausar
  createGame('app', world, { input: flap, pause });
  bindGameControls(window, { flap, pause });
}

void bootstrap();
