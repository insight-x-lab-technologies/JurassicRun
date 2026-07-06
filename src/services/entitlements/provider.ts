/** Resultado de uma solicitação de desbloqueio a um provider. */
export type UnlockOutcome = 'granted' | 'declined';

/**
 * Seam de monetização (ADR-0004). v1 = honor-system (concede na hora, sem cobrança).
 * Um gateway real (Ko-Fi/Stripe + validação) troca a implementação SEM tocar consumidores.
 */
export interface EntitlementProvider {
  requestUnlock(id: string): UnlockOutcome;
}

export const honorSystemProvider: EntitlementProvider = {
  requestUnlock: () => 'granted',
};
