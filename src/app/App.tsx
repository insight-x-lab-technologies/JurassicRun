import { route, type Screen } from './router';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { NestScreen } from './screens/NestScreen';
import { ShopScreen } from './screens/ShopScreen';
import { ExpansionsScreen } from './screens/ExpansionsScreen';
import { TrophiesScreen } from './screens/TrophiesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { profileService } from '@services/profile';
import { settingsService } from '@services/settings';
import type { VNode } from 'preact';

function screenFor(screen: Screen): VNode {
  switch (screen) {
    case 'home':
      return <HomeScreen />;
    case 'play':
      return <PlayScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'daily':
      return <PlaceholderScreen titleKey="screen.daily" />;
    case 'weekly':
      return <PlaceholderScreen titleKey="screen.weekly" />;
    case 'nest':
      return <NestScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'leaderboard':
      return <PlaceholderScreen titleKey="screen.leaderboard" />;
    case 'expansions':
      return <ExpansionsScreen />;
    case 'trophies':
      return <TrophiesScreen />;
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
  return screenFor(route.value);
}
