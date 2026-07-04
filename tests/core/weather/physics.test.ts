import { describe, it, expect } from 'vitest';
import { weatherPhysics, WEATHER_KINDS } from '@core/weather';

describe('weatherPhysics', () => {
  it('clear é baseline (sem alteração de física)', () => {
    expect(weatherPhysics('clear')).toEqual({ gravityScale: 1, windY: 0 });
  });

  it('cobre os 5 climas com pares numéricos finitos e gravityScale > 0', () => {
    expect(WEATHER_KINDS).toHaveLength(5);
    for (const k of WEATHER_KINDS) {
      const p = weatherPhysics(k);
      expect(Number.isFinite(p.gravityScale)).toBe(true);
      expect(Number.isFinite(p.windY)).toBe(true);
      expect(p.gravityScale).toBeGreaterThan(0);
    }
  });

  it('rain/storm mais pesados que clear; snow mais leve', () => {
    expect(weatherPhysics('rain').gravityScale).toBeGreaterThan(1);
    expect(weatherPhysics('storm').gravityScale).toBeGreaterThan(1);
    expect(weatherPhysics('snow').gravityScale).toBeLessThan(1);
  });

  it('wind aplica empuxo/updraft (windY negativo)', () => {
    expect(weatherPhysics('wind').windY).toBeLessThan(0);
  });
});
