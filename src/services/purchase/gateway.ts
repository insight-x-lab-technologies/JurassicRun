import { signal, type ReadonlySignal } from '@preact/signals';
import type { RedeemResponse } from '@services/online/client';

export interface RedemptionGateway {
  /** Há gateway real online? Reativo (acompanha o status online 6.3). */
  readonly available: ReadonlySignal<boolean>;
  redeem(code: string): Promise<RedeemResponse>;
}

const FALSE = signal(false);

/** Sem gateway configurado. A UI não chama `redeem` quando `available=false`. */
export const unavailableGateway: RedemptionGateway = {
  available: FALSE,
  redeem: async () => ({ ok: false, reason: 'error' }),
};

/** Double de teste: mapa código→SKU, uso único. */
export function memoryRedemptionGateway(codes: Record<string, string>): RedemptionGateway {
  const used = new Set<string>();
  const available = signal(true);
  return {
    available,
    redeem: async (code) => {
      if (!Object.prototype.hasOwnProperty.call(codes, code)) return { ok: false, reason: 'invalid' };
      if (used.has(code)) return { ok: false, reason: 'used' };
      used.add(code);
      return { ok: true, sku: codes[code]! };
    },
  };
}
