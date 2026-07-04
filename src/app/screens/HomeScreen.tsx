import { navigate, type Screen } from '../router';
import { i18n } from '@services/i18n';

const DESTINATIONS: readonly Screen[] = [
  'profile',
  'nest',
  'shop',
  'settings',
  'leaderboard',
  'expansions',
];

export function HomeScreen() {
  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t('app.title')}</h1>
      <button class="btn" onClick={() => navigate('play')}>
        {i18n.t('nav.play')}
      </button>
      {DESTINATIONS.map((screen) => (
        <button key={screen} class="btn btn--ghost" onClick={() => navigate(screen)}>
          {i18n.t(`nav.${screen}`)}
        </button>
      ))}
    </div>
  );
}
