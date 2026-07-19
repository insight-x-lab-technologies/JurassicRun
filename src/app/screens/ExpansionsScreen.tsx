import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import {
  entitlementsService,
  EXPANSION_CATALOG,
  isUnlocked,
  type ExpansionDef,
} from '@services/entitlements';
import { purchaseService } from '@services/purchase';
import { RedeemCodeForm } from '../purchase/RedeemCodeForm';

function ExpansionCard({
  exp,
  active,
  unlocked,
  gateway,
}: {
  exp: ExpansionDef;
  active: boolean;
  unlocked: boolean;
  gateway: boolean;
}): VNode {
  return (
    <li class="expansion-card" data-testid={`expansion-card-${exp.id}`}>
      <img
        class="expansion-card__avatar"
        src={`${import.meta.env.BASE_URL}ui/cover.${exp.id}.png`}
        alt=""
        aria-hidden="true"
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
      ) : gateway ? (
        <span class="expansion-card__badge expansion-card__badge--locked" data-testid={`expansion-locked-${exp.id}`}>
          {i18n.t('expansions.locked')}
        </span>
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
  const gateway = purchaseService.available.value;

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
            gateway={gateway}
          />
        ))}
      </ul>

      {gateway && <RedeemCodeForm />}

      {!gateway && <p class="expansions__note">{i18n.t('expansions.honorNote')}</p>}
      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('expansions.back')}
      </button>
    </div>
  );
}
