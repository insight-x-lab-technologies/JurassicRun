// Derivação da seed canônica (string) por modo de jogo.
// NÃO hasheia: `createRng` (em @core/rng) já hasheia a string via xmur3.
// A aleatoriedade do Endless vem de FORA do core (gerada por crypto/PRNG na camada de app).

import { type CalendarDate, formatCalendarDate, formatIsoWeek, isoWeekOf } from './calendar';

export type SeedMode = 'endless' | 'daily' | 'weekly';

/** Seed canônica do Desafio Diário: `"daily:YYYY-MM-DD"` (data UTC). */
export function dailySeed(date: CalendarDate): string {
  return `daily:${formatCalendarDate(date)}`;
}

/** Seed canônica do Desafio Semanal: `"weekly:YYYY-Www"` (semana ISO-8601). */
export function weeklySeed(date: CalendarDate): string {
  return `weekly:${formatIsoWeek(isoWeekOf(date))}`;
}

/** Seed canônica do Endless a partir de um token exibível. */
export function endlessSeed(token: string): string {
  return `endless:${token}`;
}

// Crockford base32: sem I, L, O, U (evita ambiguidade visual).
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Formata um uint32 (gerado FORA do core) num token Endless de 7 chars,
 * legível e compartilhável. Determinístico: mesmo value ⇒ mesmo token.
 */
export function randomEndlessToken(value: number): string {
  let v = value >>> 0;
  let out = '';
  for (let i = 0; i < 7; i++) {
    out = CROCKFORD[v & 0x1f]! + out;
    v = Math.floor(v / 32);
  }
  return out;
}
