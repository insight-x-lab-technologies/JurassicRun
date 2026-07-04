import { back } from '../router';
import { i18n } from '@services/i18n';

export function PlaceholderScreen({ titleKey }: { titleKey: string }) {
  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t(titleKey)}</h1>
      <p>{i18n.t('screen.comingSoon')}</p>
      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
