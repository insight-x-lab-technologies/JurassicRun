import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { trophyService, TROPHY_CATALOG, type TrophyDef } from '@services/trophy';

function TrophyCard({ def, unlocked }: { def: TrophyDef; unlocked: boolean }): VNode {
  return (
    <li
      class={`trophy-card${unlocked ? ' trophy-card--unlocked' : ''}`}
      data-testid={`trophy-card-${def.id}`}
      data-unlocked={unlocked ? 'true' : 'false'}
    >
      <span class="trophy-card__icon" aria-hidden="true">{unlocked ? '🏆' : '🔒'}</span>
      <div class="trophy-card__body">
        <h2 class="trophy-card__name">{i18n.t(def.nameKey)}</h2>
        <p class="trophy-card__desc">{i18n.t(def.descKey)}</p>
      </div>
      {!unlocked && (
        <span class="trophy-card__badge sr-only">{i18n.t('trophies.locked')}</span>
      )}
    </li>
  );
}

export function TrophiesScreen(): VNode {
  const unlocked = trophyService.unlockedIds.value;

  return (
    <div class="screen trophies">
      <h1 class="screen__title">{i18n.t('trophies.title')}</h1>

      {unlocked.length === 0 && <p class="trophies__empty">{i18n.t('trophies.empty')}</p>}

      <ul class="trophies__grid">
        {TROPHY_CATALOG.map((def) => (
          <TrophyCard key={def.id} def={def} unlocked={unlocked.includes(def.id)} />
        ))}
      </ul>

      <button type="button" class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
