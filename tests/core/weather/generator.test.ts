import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import { WeatherGenerator, DEFAULT_WEATHER_CONFIG } from '@core/weather';

const mk = () => new WeatherGenerator(createRng('endless:WX').fork('weather'));

describe('WeatherGenerator', () => {
  it('começa clear e permanece clear durante o warmup', () => {
    const g = mk();
    expect(g.current).toBe('clear');
    g.advanceTo(DEFAULT_WEATHER_CONFIG.warmupDistance - 1);
    expect(g.current).toBe('clear');
  });

  it('mesma seed ⇒ mesma sequência amostrada por distância', () => {
    const seq = (g: WeatherGenerator): string[] => {
      const out: string[] = [];
      for (let d = 0; d <= 12000; d += 100) { g.advanceTo(d); out.push(g.current); }
      return out;
    };
    expect(seq(mk())).toEqual(seq(mk()));
  });

  it('independe do batching: 1 salto grande = muitos passos pequenos', () => {
    const coarse = mk();
    const fine = mk();
    coarse.advanceTo(9999);
    for (let d = 0; d <= 9999; d += 37) fine.advanceTo(d);
    fine.advanceTo(9999);
    expect(coarse.current).toBe(fine.current);
  });

  it('muda de clima ao longo da distância (não fica preso em clear)', () => {
    const g = mk();
    const seen = new Set<string>();
    for (let d = 0; d <= 30000; d += 50) { g.advanceTo(d); seen.add(g.current); }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('clone é independente do original e determinístico', () => {
    const g = mk();
    g.advanceTo(5000);
    const c = g.clone();
    expect(c.current).toBe(g.current);
    const cloneKind = c.current;
    g.advanceTo(50000); // mexer no original não deve afetar o clone
    expect(c.current).toBe(cloneKind);
    // o clone avança por conta própria, igual a um gerador fresco levado à mesma distância
    const fresh = mk();
    fresh.advanceTo(7000);
    c.advanceTo(7000);
    expect(c.current).toBe(fresh.current);
  });
});
