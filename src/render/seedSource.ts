import { type CalendarDate, dailySeed, weeklySeed, endlessSeed, randomEndlessToken } from '@core/seed';

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

/** Parte PURA: epoch ms → CalendarDate em UTC (usa os getters UTC de Date; determinística). */
export function utcCalendarDateFromMs(ms: number): CalendarDate {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Parte PURA: epoch ms → seed canônica do Desafio Diário (`daily:AAAA-MM-DD` UTC). */
export function dailyChallengeSeedForMs(ms: number): string {
  return dailySeed(utcCalendarDateFromMs(ms));
}

/** Parte PURA: epoch ms → seed canônica do Desafio Semanal (`weekly:AAAA-Www` ISO/UTC). */
export function weeklyChallengeSeedForMs(ms: number): string {
  return weeklySeed(utcCalendarDateFromMs(ms));
}

/** Casca: seed do Desafio Diário de HOJE (relógio UTC). Fora do core (permitido). */
export function dailyChallengeSeed(): string {
  return dailyChallengeSeedForMs(Date.now());
}

/** Casca: seed do Desafio Semanal desta semana (relógio UTC). Fora do core (permitido). */
export function weeklyChallengeSeed(): string {
  return weeklyChallengeSeedForMs(Date.now());
}
