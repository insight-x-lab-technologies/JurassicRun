import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { walletService } from '@services/wallet';
import { RedeemCodeForm } from '../purchase/RedeemCodeForm';
import { COIN_PACKS } from '../shop/packs';
import { checkoutUrlFor, formatPrice, storefront } from '@services/purchase/storefront';
import { openExternal, defaultOpenDeps, type OpenUrlDeps } from '../openUrl';

export interface ShopScreenProps {
  /** Injetável só para teste: espiona a abertura da aba externa. */
  readonly openDeps?: OpenUrlDeps;
}

export function ShopScreen({ openDeps }: ShopScreenProps = {}): VNode {
  // LER o saldo é permitido; creditar não. `tests/app/shop/no-free-coins.test.ts` proíbe
  // qualquer chamada a `earn` nos arquivos da Loja — o único caminho de moeda paga é o `redeem`.
  const balance = walletService.balance.value;
  const sf = storefront();
  const deps = openDeps ?? defaultOpenDeps();

  return (
    <div class="screen shop">
      <h1 class="screen__title">{i18n.t('shop.title')}</h1>
      <p class="shop__balance" data-testid="shop-balance">
        {i18n.t('shop.balance', { value: balance })}
      </p>

      <h2 class="shop__section">{i18n.t('shop.coinPacks')}</h2>
      <p class="shop__note">{i18n.t('shop.howItWorks')}</p>
      <ul class="shop__packs" data-testid="shop-packs">
        {COIN_PACKS.map((pack) => (
          <li key={pack.id} class="shop-pack" data-testid={`shop-pack-${pack.id}`}>
            <span class="shop-pack__amount">{i18n.t('shop.pack', { value: pack.coins })}</span>
            <span class="shop-pack__price" data-testid={`shop-price-${pack.id}`}>
              {formatPrice(sf.prices[pack.id], i18n.getLanguage())}
            </span>
            <button
              type="button"
              class="btn"
              data-testid={`shop-buy-${pack.id}`}
              onClick={() => openExternal(checkoutUrlFor(sf, pack.sku), deps)}
            >
              {i18n.t('shop.buy')}
            </button>
            <span class="shop-pack__sku" data-testid={`shop-sku-${pack.id}`}>
              {i18n.t('shop.skuHint', { sku: pack.sku })}
            </span>
          </li>
        ))}
      </ul>

      <RedeemCodeForm />

      <section class="shop__free" data-testid="shop-free">
        <h2 class="shop__section">{i18n.t('shop.freeTitle')}</h2>
        <ul class="shop__free-list">
          <li>{i18n.t('shop.freePlay')}</li>
          <li>{i18n.t('shop.freeChallenges')}</li>
        </ul>
      </section>

      <p class="shop__note shop__note--muted">{i18n.t('shop.expansionsSoon')}</p>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('shop.back')}
      </button>
    </div>
  );
}
