import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import {
  entitlementsService,
  EXPANSION_CATALOG,
  isUnlocked,
  type ExpansionDef,
} from '@services/entitlements';

function ExpansionCard({
  exp,
  active,
  unlocked,
}: {
  exp: ExpansionDef;
  active: boolean;
  unlocked: boolean;
}): VNode {
  return (
    <li class="expansion-card" data-testid={`expansion-card-${exp.id}`}>
      <div
        class="expansion-card__avatar"
        aria-hidden="true"
        style={{ backgroundColor: `hsl(${exp.hue}, 60%, 45%)` }}
      />
      <h2 class="expansion-card__name">{i18n.t(exp.nameKey)}</h2>
      <p class="expansion-card__desc">{i18n.t(exp.descKey)}</p>
      {active ? (
        <span class="expansion-card__badge" data-testid={`expansion-active-${exp.id}`}>
          {i18n.t('expansions.active')}
        </span>
      ) : unlocked ? (
        <button
          type="button"
          class="btn btn--ghost"
          data-testid={`expansion-select-${exp.id}`}
          onClick={() => entitlementsService.select(exp.id)}
        >
          {i18n.t('expansions.select')}
        </button>
      ) : (
        <button
          type="button"
          class="btn"
          data-testid={`expansion-unlock-${exp.id}`}
          onClick={() => entitlementsService.unlock(exp.id)}
        >
          {i18n.t('expansions.unlock')}
        </button>
      )}
    </li>
  );
}

export function ExpansionsScreen(): VNode {
  const activeId = entitlementsService.activeExpansion.value.id;
  const unlocked = entitlementsService.unlockedIds.value;

  return (
    <div class="screen expansions">
      <h1 class="screen__title">{i18n.t('expansions.title')}</h1>

      <ul class="expansions__grid">
        {EXPANSION_CATALOG.map((exp) => (
          <ExpansionCard
            key={exp.id}
            exp={exp}
            active={exp.id === activeId}
            unlocked={isUnlocked({ unlocked, activeId }, exp.id)}
          />
        ))}
      </ul>

      <p class="expansions__note">{i18n.t('expansions.honorNote')}</p>
      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('expansions.back')}
      </button>
    </div>
  );
}
