/**
 * SEAM de carteira. A carteira persistente + ganho de moedas é o item 4.5.
 * Por ora saldo 0 e débito no-op (precedente do getHomeStats no 4.3). Único ponto a
 * religar quando a economia persistente existir.
 */
export function getCoinBalance(): number {
  return 0;
}

export function spendCoins(amount: number): void {
  void amount; // no-op até 4.5 (carteira persistente).
}
