import { render } from 'preact';
import './styles/tokens.css';
import './styles/global.css';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { nestService } from '@services/nest';
import { App } from './App';

async function bootstrap(): Promise<void> {
  await i18n.init();
  profileService.init();
  nestService.init();
  document.documentElement.lang = i18n.getLanguage();
  document.title = i18n.t('app.title');

  const root = document.getElementById('app');
  if (root === null) throw new Error('#app não encontrado');
  render(<App />, root);
}

void bootstrap();
