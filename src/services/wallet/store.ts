/** Estado da carteira global de moedas. Sempre inteiro não-negativo. */
export interface WalletState {
  readonly coins: number;
}

export function initialWalletState(): WalletState {
  return { coins: 0 };
}

/** Saneia um valor para inteiro não-negativo (negativo/NaN/fração ⇒ floor≥0). */
function sanitizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount);
}

/** Converte comida coletada numa partida em moedas. 1:1 placeholder (tuning Fase 8). */
export function coinsForFood(food: number): number {
  return sanitizeAmount(food);
}

/** Adiciona moedas. `amount` inválido ⇒ soma 0. Imutável. */
export function addCoins(state: WalletState, amount: number): WalletState {
  return { coins: state.coins + sanitizeAmount(amount) };
}

/** Debita. Falha (ok:false, estado inalterado) se saldo insuficiente ou amount inválido. */
export function spendCoins(state: WalletState, amount: number): { state: WalletState; ok: boolean } {
  const value = sanitizeAmount(amount);
  if (value === 0 || value > state.coins) return { state, ok: false };
  return { state: { coins: state.coins - value }, ok: true };
}
