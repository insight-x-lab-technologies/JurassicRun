import { describe, it, expect } from 'vitest';
import {
  IDLE_WRAP_SECONDS,
  wrapIdleTime,
  idlePhaseFor,
  swayOffset,
  dripAt,
  idleMotionFor,
  type SwayOffset,
  type DripState,
} from '@render/idle';
import { DINO_TYPE_ID } from '@render/manifest';

const sway: SwayOffset = { dx: 0 };
const drip: DripState = { y: 0, radius: 0, alpha: 0, visible: false };

describe('swayOffset', () => {
  it('extremidade ancorada (t01=0) não se move', () => {
    for (const t of [0, 0.3, 0.77, 1.9]) {
      expect(swayOffset(0.8, 0, t, 1.1, sway).dx).toBe(0);
    }
  });

  it('amplitude 0 ⇒ sem movimento', () => {
    expect(swayOffset(0, 1, 0.4, 0, sway).dx).toBe(0);
  });

  it('|dx| <= amp em qualquer instante e posição (invariante de cobertura)', () => {
    const amp = 0.6;
    for (let i = 0; i < 200; i++) {
      const elapsed = i * 0.037;
      const t01 = (i % 11) / 10;
      const dx = swayOffset(amp, t01, elapsed, idlePhaseFor(i * 13), sway).dx;
      expect(Math.abs(dx)).toBeLessThanOrEqual(amp + 1e-12);
    }
  });

  it('a ponta livre balança mais que o meio no mesmo instante', () => {
    const elapsed = 0.31; // fora de um zero da senoide
    const tip = Math.abs(swayOffset(0.8, 1, elapsed, 0, sway).dx);
    const mid = Math.abs(swayOffset(0.8, 0.5, elapsed, 0, sway).dx);
    expect(tip).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
  });

  it('clampa t01 fora de 0..1', () => {
    const at1 = swayOffset(0.8, 1, 0.31, 0, sway).dx;
    const above = swayOffset(0.8, 1.4, 0.31, 0, sway).dx;
    const below = swayOffset(0.8, -3, 0.31, 0, sway).dx;
    expect(above).toBe(at1);
    expect(below).toBe(0);
  });

  it('fases diferentes ⇒ obstáculos dessincronizados', () => {
    const a = swayOffset(0.8, 1, 0.31, idlePhaseFor(100), sway).dx;
    const b = swayOffset(0.8, 1, 0.31, idlePhaseFor(137), sway).dx;
    expect(a).not.toBeCloseTo(b, 3);
  });

  it('muta e devolve o MESMO out (alocação-zero)', () => {
    expect(swayOffset(0.8, 1, 0.31, 0, sway)).toBe(sway);
  });
});

describe('dripAt', () => {
  it('a gota engorda parada na ponta antes de cair', () => {
    const d = dripAt(0.5, 0, drip); // dentro da fase de formação (40% de 2,5s = 1,0s)
    expect(d.y).toBe(0);
    expect(d.radius).toBeGreaterThan(0);
    expect(d.visible).toBe(true);
  });

  it('depois de soltar, cai monotonicamente e some', () => {
    const y1 = dripAt(1.2, 0, drip).y;
    const y2 = dripAt(1.8, 0, drip).y;
    const end = dripAt(2.49, 0, drip);
    expect(y2).toBeGreaterThan(y1);
    expect(y1).toBeGreaterThan(0);
    expect(end.alpha).toBeLessThan(0.2);
  });

  it('o ciclo se repete (mesmo estado a cada período)', () => {
    const a = dripAt(0.7, 0, drip);
    const snapshot = { y: a.y, radius: a.radius, alpha: a.alpha, visible: a.visible };
    const b = dripAt(0.7 + 2.5, 0, drip);
    expect(b.y).toBeCloseTo(snapshot.y, 9);
    expect(b.alpha).toBeCloseTo(snapshot.alpha, 9);
    expect(b.visible).toBe(snapshot.visible);
  });

  it('fases diferentes dessincronizam as gotas', () => {
    const a = dripAt(1.2, 0, drip).y;
    const b = dripAt(1.2, Math.PI, drip).y;
    expect(a).not.toBeCloseTo(b, 3);
  });

  it('muta e devolve o MESMO out (alocação-zero)', () => {
    expect(dripAt(1.2, 0, drip)).toBe(drip);
  });
});

describe('wrapIdleTime', () => {
  it('embrulha em IDLE_WRAP_SECONDS', () => {
    expect(IDLE_WRAP_SECONDS).toBe(100);
    expect(wrapIdleTime(0.5)).toBeCloseTo(0.5, 9);
    expect(wrapIdleTime(100.5)).toBeCloseTo(0.5, 9);
    expect(wrapIdleTime(-0.5)).toBeCloseTo(99.5, 9);
  });

  it('o embrulho não dá salto visual: sway e drip fecham um número inteiro de ciclos', () => {
    const before = swayOffset(0.8, 1, IDLE_WRAP_SECONDS + 0.31, 0.4, sway).dx;
    const after = swayOffset(0.8, 1, 0.31, 0.4, sway).dx;
    expect(before).toBeCloseTo(after, 6);

    const dBefore = dripAt(IDLE_WRAP_SECONDS + 1.2, 0.4, drip).y;
    const dAfter = dripAt(1.2, 0.4, drip).y;
    expect(dBefore).toBeCloseTo(dAfter, 6);
  });
});

describe('idlePhaseFor', () => {
  it('fase estável por posição de mundo, dentro de 0..2π', () => {
    for (const x of [-500, 0, 37.5, 1200]) {
      const p = idlePhaseFor(x);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(2 * Math.PI);
      expect(idlePhaseFor(x)).toBe(p); // determinística, sem RNG
    }
  });
});

describe('idleMotionFor', () => {
  it('árvore balança ancorada embaixo; cipó ancorado em cima', () => {
    expect(idleMotionFor('obstacle.tree')).toEqual({ kind: 'sway', anchor: 'bottom', amp: 0.6 });
    expect(idleMotionFor('obstacle.vine')).toEqual({ kind: 'sway', anchor: 'top', amp: 0.8 });
  });

  it('estalactite pinga', () => {
    expect(idleMotionFor('obstacle.stalactite')).toEqual({ kind: 'drip' });
  });

  it('null para quem não anima (pedra, dino, power-ups, id desconhecido)', () => {
    expect(idleMotionFor('obstacle.boulder')).toBeNull();
    expect(idleMotionFor(DINO_TYPE_ID)).toBeNull();
    expect(idleMotionFor('powerup.shield')).toBeNull();
    expect(idleMotionFor('bird.coin')).toBeNull();
    expect(idleMotionFor('nao.existe')).toBeNull();
  });

  it('memoizado: identidade estável entre chamadas (REGRA 3)', () => {
    expect(idleMotionFor('obstacle.tree')).toBe(idleMotionFor('obstacle.tree'));
  });
});
