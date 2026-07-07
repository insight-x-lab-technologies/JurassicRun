import { describe, it, expect } from 'vitest';
import { endlessSeedFromUint32, utcCalendarDateFromMs, dailyChallengeSeedForMs, weeklyChallengeSeedForMs } from '@render/seedSource';
import { endlessSeed, randomEndlessToken } from '@core/seed';

describe('endlessSeedFromUint32', () => {
  it('produz endless:<token de 7 chars Crockford>', () => {
    const s = endlessSeedFromUint32(0);
    expect(s).toMatch(/^endless:[0-9A-HJKMNP-TV-Z]{7}$/);
  });

  it('é determinística e casa com endlessSeed(randomEndlessToken(v))', () => {
    const v = 123456789;
    expect(endlessSeedFromUint32(v)).toBe(endlessSeed(randomEndlessToken(v)));
    expect(endlessSeedFromUint32(v)).toBe(endlessSeedFromUint32(v));
  });

  it('trata o valor como uint32 (>>>0) para negativos/grandes', () => {
    expect(endlessSeedFromUint32(-1)).toBe(endlessSeedFromUint32(0xffffffff));
    expect(endlessSeedFromUint32(0x1_0000_0000)).toBe(endlessSeedFromUint32(0));
  });
});

describe('utcCalendarDateFromMs', () => {
  it('converte epoch ms → CalendarDate em UTC', () => {
    // 2026-07-07T00:00:00Z
    expect(utcCalendarDateFromMs(Date.UTC(2026, 6, 7))).toEqual({ year: 2026, month: 7, day: 7 });
    // meio-dia UTC não muda o dia
    expect(utcCalendarDateFromMs(Date.UTC(2026, 6, 7, 12, 0, 0))).toEqual({
      year: 2026,
      month: 7,
      day: 7,
    });
    // virada de ano: 2025-12-31T23:59:59Z
    expect(utcCalendarDateFromMs(Date.UTC(2025, 11, 31, 23, 59, 59))).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });
});

describe('dailyChallengeSeedForMs / weeklyChallengeSeedForMs', () => {
  it('compõem a seed canônica do dia/semana em UTC', () => {
    const ms = Date.UTC(2026, 6, 7); // terça, 2026-07-07 → ISO 2026-W28
    expect(dailyChallengeSeedForMs(ms)).toBe('daily:2026-07-07');
    expect(weeklyChallengeSeedForMs(ms)).toBe('weekly:2026-W28');
  });

  it('borda de semana ISO: 2027-01-01 pertence à semana 53 de 2026', () => {
    const ms = Date.UTC(2027, 0, 1); // sexta → ISO 2026-W53
    expect(dailyChallengeSeedForMs(ms)).toBe('daily:2027-01-01');
    expect(weeklyChallengeSeedForMs(ms)).toBe('weekly:2026-W53');
  });
});
