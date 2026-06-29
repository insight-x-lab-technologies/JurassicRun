import { describe, it, expect } from 'vitest';
import {
  difficultyAt,
  levelForDistance,
  SPEED_SCALE_MAX,
  GAP_SCALE_MIN,
  DISTANCE_PER_LEVEL,
} from '@core/difficulty';

describe('difficultyAt — ancoragem (reset por partida)', () => {
  it('em d=0: escalas 1.0 e nível 1', () => {
    const d0 = difficultyAt(0);
    expect(d0.speedScale).toBe(1);
    expect(d0.gapScale).toBe(1);
    expect(d0.level).toBe(1);
  });
  it('clampa distância negativa em 0', () => {
    expect(difficultyAt(-100)).toEqual(difficultyAt(0));
  });
});

describe('difficultyAt — monotonicidade e limites', () => {
  const samples = [0, 100, 500, 1000, 3000, 10000, 100000];
  it('speedScale estritamente crescente, gapScale estritamente decrescente', () => {
    for (let i = 1; i < samples.length; i++) {
      const a = difficultyAt(samples[i - 1]!);
      const b = difficultyAt(samples[i]!);
      expect(b.speedScale).toBeGreaterThan(a.speedScale);
      expect(b.gapScale).toBeLessThan(a.gapScale);
    }
  });
  it('limitada: 1 ≤ speedScale < MAX e MIN < gapScale ≤ 1 para todo d finito', () => {
    for (const d of [...samples, 1e7]) {
      const p = difficultyAt(d);
      expect(p.speedScale).toBeGreaterThanOrEqual(1);
      expect(p.speedScale).toBeLessThan(SPEED_SCALE_MAX);
      expect(p.gapScale).toBeLessThanOrEqual(1);
      expect(p.gapScale).toBeGreaterThan(GAP_SCALE_MIN);
    }
  });
  it('tende aos limites em d grande', () => {
    const p = difficultyAt(1e7);
    expect(p.speedScale).toBeCloseTo(SPEED_SCALE_MAX, 2);
    expect(p.gapScale).toBeCloseTo(GAP_SCALE_MIN, 2);
  });
});

describe('levelForDistance — degraus', () => {
  it('nível 1 antes do 1º degrau; sobe em múltiplos de DISTANCE_PER_LEVEL', () => {
    expect(levelForDistance(0)).toBe(1);
    expect(levelForDistance(DISTANCE_PER_LEVEL - 0.001)).toBe(1);
    expect(levelForDistance(DISTANCE_PER_LEVEL)).toBe(2);
    expect(levelForDistance(DISTANCE_PER_LEVEL * 2)).toBe(3);
    expect(levelForDistance(DISTANCE_PER_LEVEL * 5 + 1)).toBe(6);
  });
});

describe('difficultyAt — pureza', () => {
  it('mesma distância ⇒ mesmo resultado', () => {
    expect(difficultyAt(1234.5)).toEqual(difficultyAt(1234.5));
  });
});
