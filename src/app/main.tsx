import { render } from 'preact';
import './styles/tokens.css';
import './styles/global.css';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { nestService } from '@services/nest';
import { walletService } from '@services/wallet';
import { entitlementsService } from '@services/entitlements';
import { trophyService } from '@services/trophy';
import { leaderboardService } from '@services/leaderboard';
import { replayService } from '@services/replay';
import { settingsService } from '@services/settings';
import { audioService, bindButtonSfx } from '@services/audio';
import { onlineService } from '@services/online';
import { createLeaderboardOnline } from './online/leaderboardAdapter';
import { createTrophyOnline } from './online/trophyAdapter';
import { bindPackTheme } from './theme';
import { App } from './App';

async function bootstrap(): Promise<void> {
  await i18n.init();
  await settingsService.init();
  profileService.init();
  void onlineService.init(); // fire-and-forget, não-bloqueante (offline-first)
  nestService.init();
  walletService.init();
  entitlementsService.init();
  bindPackTheme(); // tema CSS do pack ativo, reativo (8.3)
  trophyService.init(undefined, createTrophyOnline());
  leaderboardService.init(undefined, createLeaderboardOnline());
  replayService.init();

  const root = document.getElementById('app');
  if (root === null) throw new Error('#app não encontrado');
  render(<App />, root);

  audioService.init();
  bindButtonSfx(document.body);
}

void bootstrap();
