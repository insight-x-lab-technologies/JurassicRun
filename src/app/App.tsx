import { route, type Screen } from './router';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ChallengeScreen } from './screens/ChallengeScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { NestScreen } from './screens/NestScreen';
import { ShopScreen } from './screens/ShopScreen';
import { ExpansionsScreen } from './screens/ExpansionsScreen';
import { TrophiesScreen } from './screens/TrophiesScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DonateScreen } from './screens/DonateScreen';
import { NavBar } from './components/NavBar';
import { profileService } from '@services/profile';
import { settingsService } from '@services/settings';
import type { VNode } from 'preact';

/** Sub-telas DOM que exibem a barra de navegação inferior (não home/play/daily/weekly/onboarding). */
const NAV_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  'nest', 'shop', 'expansions', 'leaderboard', 'settings', 'donate', 'trophies', 'profile',
]);

function screenFor(screen: Screen): VNode {
  switch (screen) {
    case 'home':
      return <HomeScreen />;
    case 'play':
      return <PlayScreen mode="endless" />;
    case 'profile':
      return <ProfileScreen />;
    case 'daily':
      // `key` força remontagem ao trocar de modo: sem ele, o Preact reaproveita a MESMA
      // instância (mesmo tipo de componente) e o estado interno `playing` vazaria entre
      // Diário/Semanal, pulando o briefing do modo recém-navegado.
      return <ChallengeScreen key="daily" mode="daily" />;
    case 'weekly':
      return <ChallengeScreen key="weekly" mode="weekly" />;
    case 'nest':
      return <NestScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'leaderboard':
      return <LeaderboardScreen />;
    case 'expansions':
      return <ExpansionsScreen />;
    case 'trophies':
      return <TrophiesScreen />;
    case 'donate':
      return <DonateScreen />;
    default: {
      const _never: never = screen;
      return _never;
    }
  }
}

export function App(): VNode {
  // Assinar o idioma: qualquer troca re-renderiza a árvore inteira com as strings novas.
  void settingsService.language.value;
  if (profileService.activeProfile.value === null) {
    return <OnboardingScreen />;
  }
  const screen = route.value;
  return (
    <>
      {screenFor(screen)}
      {NAV_SCREENS.has(screen) && <NavBar current={screen} />}
    </>
  );
}
