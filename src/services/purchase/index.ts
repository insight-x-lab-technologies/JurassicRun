import { signal, computed, type ReadonlySignal } from '@preact/signals';
import { walletService } from '@services/wallet';
import { entitlementsService } from '@services/entitlements';
import { parseSku, skuEffect, type Sku } from './sku';
import { unavailableGateway, type RedemptionGateway } from './gateway';

export type PurchaseStatus = 'ok' | 'invalid' | 'used' | 'unavailable' | 'error';
export interface PurchaseResult {
  readonly status: PurchaseStatus;
  readonly sku?: Sku;
}

interface WalletLike {
  earn(amount: number): void;
}
interface EntitlementsLike {
  grantAndSelect(id: string): void;
}
export interface PurchaseDeps {
  gateway?: RedemptionGateway;
  wallet?: WalletLike;
  entitlements?: EntitlementsLike;
}

class PurchaseService {
  private gateway: RedemptionGateway = unavailableGateway;
  private wallet: WalletLike = walletService;
  private entitlements: EntitlementsLike = entitlementsService;
  private readonly _available = signal<ReadonlySignal<boolean>>(unavailableGateway.available);

  /** Disponibilidade do gateway real (reativa). */
  readonly available: ReadonlySignal<boolean> = computed(() => this._available.value.value);

  init(deps: PurchaseDeps = {}): void {
    this.gateway = deps.gateway ?? unavailableGateway;
    this.wallet = deps.wallet ?? walletService;
    this.entitlements = deps.entitlements ?? entitlementsService;
    this._available.value = this.gateway.available;
  }

  /** Resgata um código. Best-effort: nunca lança. Só aplica o efeito em sucesso. */
  async redeem(code: string): Promise<PurchaseResult> {
    const trimmed = code.trim();
    if (trimmed === '') return { status: 'invalid' };
    if (!this.gateway.available.value) return { status: 'unavailable' };

    let response;
    try {
      response = await this.gateway.redeem(trimmed);
    } catch {
      return { status: 'error' };
    }

    if (!response.ok) {
      const reason = response.reason;
      if (reason === 'invalid' || reason === 'used') return { status: reason };
      return { status: 'error' };
    }

    const sku = response.sku !== undefined ? parseSku(response.sku) : null;
    if (sku === null) return { status: 'error' }; // servidor mandou SKU desconhecido: não aplica

    const effect = skuEffect(sku);
    if (effect.kind === 'coins') this.wallet.earn(effect.coins);
    else this.entitlements.grantAndSelect(effect.expansionId);
    return { status: 'ok', sku };
  }
}

export const purchaseService = new PurchaseService();
export type { Sku } from './sku';
