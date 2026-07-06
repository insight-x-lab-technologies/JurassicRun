import type { VNode } from 'preact';
import { navigate, type Screen } from '../router';
import { i18n } from '@services/i18n';
import { profileService, avatarFor, type Profile } from '@services/profile';
import { getHomeStats } from '../home/stats';
import { shareGame, defaultShareDeps } from '../home/share';
import { openDonation, defaultDonateDeps } from '../home/donate';

// Destinos de navegação do menu, na ordem do roadmap 4.3.
const MENU: readonly Screen[] = [
  'daily',
  'weekly',
  'nest',
  'shop',
  'expansions',
  'leaderboard',
  'settings',
];

function Avatar({ profile }: { profile: Profile }): VNode {
  const { initial, hue } = avatarFor(profile);
  return (
    <span class="avatar" style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}>
      {initial}
    </span>
  );
}

function StatChip({ glyph, label, value }: { glyph: string; label: string; value: number }): VNode {
  return (
    <div class="stat-chip" aria-label={`${value} ${label}`}>
      <span class="stat-chip__glyph" aria-hidden="true">
        {glyph}
      </span>
      <span class="stat-chip__value">{value}</span>
      <span class="stat-chip__label">{label}</span>
    </div>
  );
}

export function HomeScreen(): VNode {
  const active = profileService.activeProfile.value;
  const stats = getHomeStats();

  return (
    <div class="home">
      <h1 class="sr-only">{i18n.t('app.title')}</h1>
      <header class="home__topbar">
        {active !== null && (
          <button
            type="button"
            class="home__identity"
            data-testid="home-identity"
            onClick={() => navigate('profile')}
          >
            <Avatar profile={active} />
            <span class="home__name">{active.name}</span>
          </button>
        )}
        <div class="home__stats">
          <StatChip glyph="🪙" label={i18n.t('home.coins')} value={stats.coins} />
          <button
            type="button"
            class="home__statbtn"
            data-testid="home-trophies"
            onClick={() => navigate('trophies')}
          >
            <StatChip glyph="🏆" label={i18n.t('home.trophies')} value={stats.trophies} />
          </button>
          <StatChip glyph="📈" label={i18n.t('home.level')} value={stats.maxLevel} />
        </div>
      </header>

      <main class="home__menu">
        <button class="btn home__primary" onClick={() => navigate('play')}>
          {i18n.t('home.newGame')}
        </button>

        <div class="home__grid">
          {MENU.map((screen) => (
            <button key={screen} class="btn btn--ghost" onClick={() => navigate(screen)}>
              {i18n.t(`nav.${screen}`)}
            </button>
          ))}
        </div>

        <div class="home__actions">
          <button class="btn btn--ghost" onClick={() => void shareGame(defaultShareDeps())}>
            {i18n.t('nav.share')}
          </button>
          <button
            class="btn btn--ghost"
            data-testid="home-donate"
            onClick={() => openDonation(defaultDonateDeps())}
          >
            {i18n.t('nav.donate')}
          </button>
        </div>
      </main>
    </div>
  );
}
