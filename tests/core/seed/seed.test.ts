import { describe, it, expect } from 'vitest';
import { dailySeed, weeklySeed, endlessSeed, randomEndlessToken } from '@core/seed';

describe('dailySeed', () => {
  it('monta a string canônica diária', () => {
    expect(dailySeed({ year: 2026, month: 6, day: 28 })).toBe('daily:2026-06-28');
    expect(dailySeed({ year: 2026, month: 1, day: 5 })).toBe('daily:2026-01-05');
  });

  it('mesma data ⇒ mesma seed; datas diferentes ⇒ seeds diferentes', () => {
    const a = dailySeed({ year: 2026, month: 6, day: 28 });
    const b = dailySeed({ year: 2026, month: 6, day: 28 });
    const c = dailySeed({ year: 2026, month: 6, day: 29 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('weeklySeed', () => {
  it('monta a string canônica semanal', () => {
    expect(weeklySeed({ year: 2026, month: 6, day: 28 })).toBe('weekly:2026-W26');
    expect(weeklySeed({ year: 2021, month: 1, day: 1 })).toBe('weekly:2020-W53');
  });

  it('dias da mesma semana ISO ⇒ mesma seed; semanas diferentes ⇒ diferentes', () => {
    const monday = weeklySeed({ year: 2026, month: 6, day: 22 });
    const sunday = weeklySeed({ year: 2026, month: 6, day: 28 });
    const nextWeek = weeklySeed({ year: 2026, month: 6, day: 29 });
    expect(monday).toBe(sunday);
    expect(monday).not.toBe(nextWeek);
  });
});

describe('endlessSeed', () => {
  it('faz namespacing do token', () => {
    expect(endlessSeed('K7P2QXM')).toBe('endless:K7P2QXM');
  });

  it('não colide com daily/weekly do mesmo texto', () => {
    expect(endlessSeed('2026-06-28')).not.toBe(dailySeed({ year: 2026, month: 6, day: 28 }));
  });
});

describe('randomEndlessToken', () => {
  it('é determinístico: mesmo value ⇒ mesmo token', () => {
    expect(randomEndlessToken(123456789)).toBe(randomEndlessToken(123456789));
  });

  it('tem 7 chars do charset Crockford (sem I,L,O,U)', () => {
    const token = randomEndlessToken(0xdeadbeef);
    expect(token).toHaveLength(7);
    expect(token).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{7}$/);
  });

  it('values distintos ⇒ tokens distintos', () => {
    expect(randomEndlessToken(0)).not.toBe(randomEndlessToken(1));
  });

  it('value 0 ⇒ token todo-zero', () => {
    expect(randomEndlessToken(0)).toBe('0000000');
  });
});
