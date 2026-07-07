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
import { settingsService } from '@services/settings';
import { audioService, bindButtonSfx } from '@services/audio';
import { App } from './App';

async function bootstrap(): Promise<void> {
  await i18n.init();
  await settingsService.init();
  profileService.init();
  nestService.init();
  walletService.init();
  entitlementsService.init();
  trophyService.init();
  leaderboardService.init();

  const root = document.getElementById('app');
  if (root === null) throw new Error('#app não encontrado');
  render(<App />, root);

  audioService.init();
  bindButtonSfx(document.body);
}

void bootstrap();
