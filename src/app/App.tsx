import { route, type Screen } from './router';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { profileService } from '@services/profile';
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
      return <PlaceholderScreen titleKey="screen.nest" />;
    case 'shop':
      return <PlaceholderScreen titleKey="screen.shop" />;
    case 'settings':
      return <PlaceholderScreen titleKey="screen.settings" />;
    case 'leaderboard':
      return <PlaceholderScreen titleKey="screen.leaderboard" />;
    case 'expansions':
      return <PlaceholderScreen titleKey="screen.expansions" />;
    default: {
      const _never: never = screen;
      return _never;
    }
  }
}

export function App(): VNode {
  if (profileService.activeProfile.value === null) {
    return <OnboardingScreen />;
  }
  return screenFor(route.value);
}
