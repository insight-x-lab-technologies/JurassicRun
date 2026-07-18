import { computed, type ReadonlySignal } from '@preact/signals';
import { onlineService } from '@services/online';
import type { RedemptionGateway } from '@services/purchase/gateway';
import type { RedeemResponse } from '@services/online/client';

interface OnlineRedeemLike {
  readonly online: ReadonlySignal<boolean>;
  redeemCode(code: string): Promise<RedeemResponse>;
}

/** Liga o gateway ao onlineService: disponível quando online; delega o resgate. */
export function createRedemptionGateway(online: OnlineRedeemLike = onlineService): RedemptionGateway {
  return {
    available: computed(() => online.online.value),
    redeem: (code) => online.redeemCode(code),
  };
}
