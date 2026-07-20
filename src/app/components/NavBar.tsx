import type { VNode } from 'preact';
import { navigate, type Screen } from '../router';
import { i18n } from '@services/i18n';

/** Destinos de navegação da barra inferior (atalhos do menu). */
const NAV: readonly Screen[] = ['daily', 'weekly', 'nest', 'shop', 'expansions', 'leaderboard', 'settings'];

/** Barra de navegação inferior (chrome W2): ícone + rótulo por destino, emoldurada por `nav.bar`. */
export function NavBar({ current }: { current: Screen }): VNode {
  const base = import.meta.env.BASE_URL;
  return (
    <nav class="navbar" aria-label={i18n.t('app.title')}>
      {NAV.map((screen) => (
        <button
          key={screen}
          type="button"
          class={`navbar__item${screen === current ? ' navbar__item--active' : ''}`}
          aria-current={screen === current ? 'page' : undefined}
          data-testid={`navbar-${screen}`}
          onClick={() => navigate(screen)}
        >
          <img class="navbar__icon" src={`${base}ui/icon.${screen}.png`} alt="" aria-hidden="true" />
          <span class="navbar__label">{i18n.t(`nav.${screen}`)}</span>
        </button>
      ))}
    </nav>
  );
}
