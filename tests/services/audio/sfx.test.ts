import { describe, it, expect } from 'vitest';
import { SFX_CATALOG, SFX_IDS, sfxDurationSec, sfxDetune, sfxChannelFor } from '@services/audio/sfx';

describe('SFX_CATALOG', () => {
  it('cobre os 9 eventos', () => {
    expect([...SFX_IDS].sort()).toEqual(
      ['block', 'click', 'coin', 'flap', 'gameOver', 'hit', 'levelUp', 'nearMiss', 'powerup'],
    );
    for (const id of SFX_IDS) expect(SFX_CATALOG[id]).toBeDefined();
  });

  it('camadas têm envelope e ganho sãos', () => {
    for (const id of SFX_IDS) {
      const spec = SFX_CATALOG[id];
      expect(spec.layers.length).toBeGreaterThan(0);
      for (const l of spec.layers) {
        expect(l.gain).toBeGreaterThan(0);
        expect(l.gain).toBeLessThanOrEqual(1);
        expect(l.attackSec).toBeGreaterThan(0);
        expect(l.decaySec).toBeGreaterThan(0);
        expect(l.delaySec).toBeGreaterThanOrEqual(0);
        expect(l.freq).toBeGreaterThan(0);
        if (l.freqEnd !== undefined) expect(l.freqEnd).toBeGreaterThan(0);
        if (l.filterHz !== undefined) expect(l.filterHz).toBeGreaterThan(0);
      }
    }
  });

  it('nenhum SFX passa de 1,5 s (não atropela o gameplay)', () => {
    for (const id of SFX_IDS) {
      const d = sfxDurationSec(SFX_CATALOG[id]);
      expect(d).toBeGreaterThan(0.02);
      expect(d).toBeLessThanOrEqual(1.5);
    }
  });

  it('o flap é curto o bastante para taps rápidos', () => {
    expect(sfxDurationSec(SFX_CATALOG.flap)).toBeLessThan(0.35);
  });

  it('a soma dos ganhos por instante não estoura (headroom)', () => {
    for (const id of SFX_IDS) {
      const total = SFX_CATALOG[id].layers.reduce((s, l) => s + l.gain, 0);
      expect(total).toBeLessThanOrEqual(2);
    }
  });
});

describe('sfxDetune', () => {
  it('é determinístico e limitado a ±1 semitom', () => {
    for (let n = 0; n < 50; n += 1) {
      const a = sfxDetune('flap', n);
      expect(a).toBe(sfxDetune('flap', n));
      expect(Math.abs(a)).toBeLessThanOrEqual(100);
    }
  });

  it('varia entre reproduções consecutivas', () => {
    const values = new Set([0, 1, 2, 3, 4, 5].map((n) => sfxDetune('flap', n)));
    expect(values.size).toBeGreaterThan(1);
  });

  it('o clique não varia (feedback de UI estável)', () => {
    expect(sfxDetune('click', 0)).toBe(0);
    expect(sfxDetune('click', 7)).toBe(0);
  });
});

describe('sfxChannelFor', () => {
  it('só o click é do canal de UI; todo o resto é gameplay', () => {
    expect(sfxChannelFor('click')).toBe('ui');
    for (const id of ['flap', 'coin', 'powerup', 'hit', 'gameOver', 'nearMiss', 'levelUp', 'block'] as const) {
      expect(sfxChannelFor(id)).toBe('game');
    }
  });
});
