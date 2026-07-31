import type { VNode } from 'preact';
import { navigate, type Screen } from '../router';
import { i18n } from '@services/i18n';
import { profileService } from '@services/profile';
import { getHomeStats } from '../home/stats';
import { ShareLinks, defaultShareLinkProps } from '../components/ShareLinks';
import { Avatar } from '../components/Avatar';

/**
 * Destinos do menu, na ordem do roadmap 4.3 + `donate` no fim: a Doação virou TELA (mesmo padrão
 * das outras) e por isso entra no mesmo grid, com o mesmo tamanho — ela cai ao lado de
 * Configurações em qualquer largura que caiba 2+ colunas.
 */
const MENU: readonly Screen[] = [
  'daily',
  'weekly',
  'nest',
  'shop',
  'expansions',
  'leaderboard',
  'settings',
  'donate',
];

const NAV_ICON: Record<string, string> = {
  daily: 'icon.daily',
  weekly: 'icon.weekly',
  nest: 'icon.nest',
  shop: 'icon.shop',
  expansions: 'icon.expansions',
  leaderboard: 'icon.leaderboard',
  settings: 'icon.settings',
  donate: 'icon.donate',
};
function navIcon(id: string): string {
  return `${import.meta.env.BASE_URL}ui/${id}.png`;
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
      <img class="home__logo" src={`${import.meta.env.BASE_URL}ui/logo.png`} alt="" />
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
              <img
                class="nav-icon"
                src={navIcon(NAV_ICON[screen] ?? 'icon.nest')}
                alt=""
                aria-hidden="true"
              />
              {i18n.t(`nav.${screen}`)}
            </button>
          ))}
        </div>

        <ShareLinks {...defaultShareLinkProps()} />

        <p class="home__copyright">
          {i18n.t('home.copyright')}{' '}
          <span class="home__version" data-testid="app-version">
            {`v${__APP_VERSION__}`}
          </span>
        </p>
      </main>
    </div>
  );
}
