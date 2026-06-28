import { describe, it, expect } from 'vitest';
import {
  isLeapYear,
  ordinalDay,
  dayOfWeek,
  weeksInYear,
  isoWeekOf,
  formatCalendarDate,
  formatIsoWeek,
} from '@core/seed/calendar';

describe('isLeapYear', () => {
  it('reconhece anos bissextos e comuns', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
  });
});

describe('ordinalDay', () => {
  it('calcula o dia do ano', () => {
    expect(ordinalDay({ year: 2026, month: 1, day: 1 })).toBe(1);
    expect(ordinalDay({ year: 2026, month: 12, day: 31 })).toBe(365);
    expect(ordinalDay({ year: 2024, month: 12, day: 31 })).toBe(366); // bissexto
    expect(ordinalDay({ year: 2024, month: 3, day: 1 })).toBe(61); // pós-29/fev
  });
});

describe('dayOfWeek (ISO 1=seg..7=dom)', () => {
  it('bate com datas conhecidas', () => {
    expect(dayOfWeek({ year: 2026, month: 6, day: 28 })).toBe(7); // domingo
    expect(dayOfWeek({ year: 2021, month: 1, day: 1 })).toBe(5); // sexta
    expect(dayOfWeek({ year: 2024, month: 12, day: 30 })).toBe(1); // segunda
  });
});

describe('weeksInYear', () => {
  it('identifica anos de 53 semanas ISO', () => {
    expect(weeksInYear(2020)).toBe(53);
    expect(weeksInYear(2015)).toBe(53);
    expect(weeksInYear(2026)).toBe(53);
    expect(weeksInYear(2024)).toBe(52);
    expect(weeksInYear(2025)).toBe(52);
  });
});

describe('isoWeekOf', () => {
  it('calcula semana ISO com bordas de virada de ano', () => {
    expect(isoWeekOf({ year: 2026, month: 6, day: 28 })).toEqual({ weekYear: 2026, week: 26 });
    expect(isoWeekOf({ year: 2021, month: 1, day: 1 })).toEqual({ weekYear: 2020, week: 53 });
    expect(isoWeekOf({ year: 2024, month: 12, day: 30 })).toEqual({ weekYear: 2025, week: 1 });
    expect(isoWeekOf({ year: 2020, month: 12, day: 31 })).toEqual({ weekYear: 2020, week: 53 });
    expect(isoWeekOf({ year: 2016, month: 1, day: 1 })).toEqual({ weekYear: 2015, week: 53 });
  });

  it('dá a mesma semana para seg..dom da mesma semana', () => {
    const monday = isoWeekOf({ year: 2026, month: 6, day: 22 });
    const sunday = isoWeekOf({ year: 2026, month: 6, day: 28 });
    expect(monday).toEqual(sunday);
    expect(monday).toEqual({ weekYear: 2026, week: 26 });
  });
});

describe('formatadores', () => {
  it('formata data com zero-padding', () => {
    expect(formatCalendarDate({ year: 2026, month: 1, day: 5 })).toBe('2026-01-05');
    expect(formatCalendarDate({ year: 2026, month: 12, day: 31 })).toBe('2026-12-31');
  });

  it('formata semana ISO com zero-padding', () => {
    expect(formatIsoWeek({ weekYear: 2026, week: 2 })).toBe('2026-W02');
    expect(formatIsoWeek({ weekYear: 2020, week: 53 })).toBe('2020-W53');
  });
});
