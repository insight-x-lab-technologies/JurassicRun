import { describe, it, expect } from 'vitest';
import {
  EFFECT_ORDER,
  EFFECT_DURATION_STEPS,
  EFFECT_COLORS,
  effectViews,
  auraPulse,
  AURA_MIN_ALPHA,
  AURA_MAX_ALPHA,
  AURA_PULSE_HZ,
} from '../../src/render/effects';
import { SHIELD_DURATION_STEPS } from '@core/powerup';
import { HEAD_START_SHIELD_STEPS } from '@core/dino';

describe('effectViews', () => {
  it('mapeia kind, segundos (ceil) e fração da duração nominal', () => {
    const [v] = effectViews([{ kind: 'shield', remaining: SHIELD_DURATION_STEPS }]);
    expect(v!.kind).toBe('shield');
    expect(v!.seconds).toBe(Math.ceil(SHIELD_DURATION_STEPS / 60));
    expect(v!.fraction).toBeCloseTo(1, 9);
  });

  it('usa a ORDEM CANÔNICA, não a ordem de pickup', () => {
    const views = effectViews([
      { kind: 'doubleCoin', remaining: 10 },
      { kind: 'shield', remaining: 10 },
    ]);
    expect(views.map((v) => v.kind)).toEqual(['shield', 'doubleCoin']);
  });

  it('nunca reporta 0 segundo enquanto o efeito ainda vale 1 step', () => {
    const [v] = effectViews([{ kind: 'magnet', remaining: 1 }]);
    expect(v!.seconds).toBe(1);
  });

  it('clampa a fração em [0,1] mesmo com remaining acima do nominal', () => {
    const [v] = effectViews([{ kind: 'shield', remaining: SHIELD_DURATION_STEPS * 3 }]);
    expect(v!.fraction).toBe(1);
  });

  it('escudo curto do traço headStart nasce com fração parcial (não é bug)', () => {
    const [v] = effectViews([{ kind: 'shield', remaining: HEAD_START_SHIELD_STEPS }]);
    expect(v!.fraction).toBeCloseTo(HEAD_START_SHIELD_STEPS / SHIELD_DURATION_STEPS, 9);
    expect(v!.fraction).toBeLessThan(1);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(effectViews([])).toEqual([]);
  });

  it('ignora kinds fora da ordem canônica (extraLife é carga, não efeito)', () => {
    expect(effectViews([{ kind: 'extraLife', remaining: 60 }])).toEqual([]);
  });
});

describe('catálogo', () => {
  it('toda entrada da ordem canônica tem duração positiva e cor', () => {
    for (const kind of EFFECT_ORDER) {
      expect(EFFECT_DURATION_STEPS[kind]).toBeGreaterThan(0);
      expect(EFFECT_COLORS[kind]).toBeGreaterThanOrEqual(0);
    }
  });

  it('extraLife não é um efeito temporário exibível', () => {
    expect(EFFECT_ORDER).not.toContain('extraLife');
  });
});

describe('auraPulse', () => {
  it('fica dentro da faixa de alpha em toda a amostragem', () => {
    for (let i = 0; i <= 200; i++) {
      const a = auraPulse(i / 100);
      expect(a).toBeGreaterThanOrEqual(AURA_MIN_ALPHA - 1e-9);
      expect(a).toBeLessThanOrEqual(AURA_MAX_ALPHA + 1e-9);
    }
  });

  it('é periódica em 1/AURA_PULSE_HZ', () => {
    const period = 1 / AURA_PULSE_HZ;
    expect(auraPulse(0.31 + period)).toBeCloseTo(auraPulse(0.31), 9);
  });

  it('é pura (mesma entrada ⇒ mesma saída)', () => {
    expect(auraPulse(2.5)).toBe(auraPulse(2.5));
  });
});
