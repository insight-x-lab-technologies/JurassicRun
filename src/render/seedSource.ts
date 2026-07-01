import { endlessSeed, randomEndlessToken } from '@core/seed';

/** Parte PURA: uint32 → seed Endless canônica exibível. Determinística. */
export function endlessSeedFromUint32(value: number): string {
  return endlessSeed(randomEndlessToken(value >>> 0));
}

/**
 * Casca (não testada por unidade): sorteia um uint32 real via `crypto` — a
 * aleatoriedade do Endless vem de FORA do core (permitido; ver core/seed/seed.ts).
 */
export function randomEndlessSeed(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return endlessSeedFromUint32(buf[0]!);
}
