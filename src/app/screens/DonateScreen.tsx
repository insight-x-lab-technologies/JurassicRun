import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { DONATE_OPTIONS, openDonation, defaultDonateDeps } from '../home/donate';

/**
 * Tela de Doação: "por que doar" + "como doar" com um card por plataforma.
 * Honor-system (ADR-0004) — abre a plataforma externa, não processa pagamento aqui.
 */
export function DonateScreen(): VNode {
  return (
    <div class="screen donate">
      <h1 class="screen__title">{i18n.t('donate.title')}</h1>

      <section class="donate__section">
        <h2 class="donate__heading">{i18n.t('donate.whyTitle')}</h2>
        <p class="donate__text">{i18n.t('donate.whyBody')}</p>
      </section>

      <section class="donate__section">
        <h2 class="donate__heading">{i18n.t('donate.howTitle')}</h2>
        <p class="donate__text">{i18n.t('donate.howBody')}</p>

        <ul class="donate__options">
          {DONATE_OPTIONS.map((option) => (
            <li key={option.id} class="donate-card" data-testid={`donate-${option.id}`}>
              <span class="donate-card__brand">{option.brand}</span>
              <span class="donate-card__desc">{i18n.t(`donate.platform.${option.id}`)}</span>
              <button
                type="button"
                class="btn"
                data-testid={`donate-open-${option.id}`}
                onClick={() => openDonation(defaultDonateDeps(), option.url)}
              >
                {i18n.t('donate.open')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p class="donate__note">{i18n.t('donate.thanks')}</p>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
