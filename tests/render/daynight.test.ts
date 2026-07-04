import { describe, it, expect } from 'vitest';
import {
  TIME_OF_DAY_ORDER,
  DAY_NIGHT_PALETTES,
  timeOfDayForSeed,
  paletteFor,
} from '@render/daynight';
import type { TimeOfDay } from '@render/daynight';

describe('daynight catalog', () => {
  it('tem uma paleta para cada fase da ordem (e nenhuma órfã)', () => {
    for (const tod of TIME_OF_DAY_ORDER) {
      expect(DAY_NIGHT_PALETTES[tod]).toBeDefined();
    }
    expect(Object.keys(DAY_NIGHT_PALETTES).length).toBe(TIME_OF_DAY_ORDER.length);
  });

  it('cada paleta expõe 4 cores inteiras válidas (0..0xffffff)', () => {
    for (const tod of TIME_OF_DAY_ORDER) {
      const p = paletteFor(tod);
      for (const c of [p.sky, p.ground, p.ceiling, p.parallaxTint]) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(0xffffff);
      }
    }
  });
});

describe('timeOfDayForSeed', () => {
  it('é determinístico: a mesma seed devolve sempre a mesma fase', () => {
    const seeds = ['endless:GOLD1', 'endless:GOLD2', 'daily:2026-07-03', 'weekly:2026-W27'];
    for (const s of seeds) {
      expect(timeOfDayForSeed(s)).toBe(timeOfDayForSeed(s));
    }
  });

  it('sempre devolve uma fase de TIME_OF_DAY_ORDER', () => {
    for (let i = 0; i < 200; i++) {
      const tod = timeOfDayForSeed(`endless:SEED${i}`);
      expect(TIME_OF_DAY_ORDER).toContain(tod);
    }
  });

  it('a seleção varia entre seeds (não colapsa numa fase só)', () => {
    const seen = new Set<TimeOfDay>();
    for (let i = 0; i < 200; i++) seen.add(timeOfDayForSeed(`endless:SEED${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
