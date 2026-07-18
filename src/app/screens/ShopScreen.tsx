import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { walletService } from '@services/wallet';
import { purchaseService } from '@services/purchase';
import { RedeemCodeForm } from '../purchase/RedeemCodeForm';
import { COIN_PACKS } from '../shop/packs';

export function ShopScreen(): VNode {
  const balance = walletService.balance.value;
  const gateway = purchaseService.available.value;

  return (
    <div class="screen shop">
      <h1 class="screen__title">{i18n.t('shop.title')}</h1>
      <p class="shop__balance" data-testid="shop-balance">
        {i18n.t('shop.balance', { value: balance })}
      </p>

      {gateway ? (
        <RedeemCodeForm />
      ) : (
        <>
          <h2 class="shop__section">{i18n.t('shop.coinPacks')}</h2>
          <ul class="shop__packs">
            {COIN_PACKS.map((pack) => (
              <li key={pack.id} class="shop-pack" data-testid={`shop-pack-${pack.id}`}>
                <span class="shop-pack__amount">{i18n.t('shop.pack', { value: pack.coins })}</span>
                <button
                  type="button"
                  class="btn"
                  data-testid={`shop-buy-${pack.id}`}
                  onClick={() => walletService.earn(pack.coins)}
                >
                  {i18n.t('shop.grant')}
                </button>
              </li>
            ))}
          </ul>
          <p class="shop__note">{i18n.t('shop.honorNote')}</p>
        </>
      )}
      <p class="shop__note shop__note--muted">{i18n.t('shop.expansionsSoon')}</p>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('shop.back')}
      </button>
    </div>
  );
}
