import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { nestService, DINO_ROSTER, isOwned, type DinoDef } from '@services/nest';
import { getCoinBalance } from '@services/nest/wallet';

function DinoCard({
  dino,
  active,
  owned,
  balance,
}: {
  dino: DinoDef;
  active: boolean;
  owned: boolean;
  balance: number;
}): VNode {
  return (
    <li class="dino-card" data-testid={`dino-card-${dino.id}`}>
      <div
        class="dino-card__avatar"
        aria-hidden="true"
        style={{ backgroundColor: `hsl(${dino.hue}, 60%, 45%)` }}
      />
      <h2 class="dino-card__name">{i18n.t(dino.nameKey)}</h2>
      <p class="dino-card__trait">{i18n.t(`trait.${dino.traitKind}.desc`)}</p>
      {active ? (
        <span class="dino-card__badge" data-testid={`dino-active-${dino.id}`}>
          {i18n.t('nest.active')}
        </span>
      ) : owned ? (
        <button
          type="button"
          class="btn btn--ghost"
          data-testid={`dino-select-${dino.id}`}
          onClick={() => nestService.select(dino.id)}
        >
          {i18n.t('nest.select')}
        </button>
      ) : (
        <button
          type="button"
          class="btn"
          data-testid={`dino-buy-${dino.id}`}
          disabled={balance < dino.price}
          onClick={() => nestService.buy(dino.id)}
        >
          {i18n.t('nest.buy')} · {i18n.t('nest.price', { value: dino.price })}
        </button>
      )}
    </li>
  );
}

export function NestScreen(): VNode {
  const activeId = nestService.activeDino.value.id;
  const owned = nestService.ownedIds.value;
  const balance = getCoinBalance();

  return (
    <div class="screen nest">
      <h1 class="screen__title">{i18n.t('nest.title')}</h1>

      <ul class="nest__grid">
        {DINO_ROSTER.map((dino) => (
          <DinoCard
            key={dino.id}
            dino={dino}
            active={dino.id === activeId}
            owned={isOwned({ owned, activeId }, dino.id)}
            balance={balance}
          />
        ))}
      </ul>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nest.back')}
      </button>
    </div>
  );
}
