import { describe, it, expect } from 'vitest';
import { activateEffect, tickEffects, isEffectActive, cloneEffects } from '@core/powerup';
import type { ActiveEffect } from '@core/powerup';

describe('effects framework', () => {
  it('activateEffect adds a new timed effect', () => {
    const e: ActiveEffect[] = [];
    activateEffect(e, 'shield', 10);
    expect(e).toEqual([{ kind: 'shield', remaining: 10 }]);
    expect(isEffectActive(e, 'shield')).toBe(true);
    expect(isEffectActive(e, 'magnet')).toBe(false);
  });

  it('activateEffect on existing kind extends to the max remaining', () => {
    const e: ActiveEffect[] = [];
    activateEffect(e, 'shield', 10);
    activateEffect(e, 'shield', 5); // menor: não encurta
    expect(e).toEqual([{ kind: 'shield', remaining: 10 }]);
    activateEffect(e, 'shield', 20); // maior: estende
    expect(e).toEqual([{ kind: 'shield', remaining: 20 }]);
  });

  it('tickEffects decrements and removes at zero', () => {
    const e: ActiveEffect[] = [];
    activateEffect(e, 'shield', 2);
    activateEffect(e, 'magnet', 1);
    tickEffects(e); // shield 1, magnet 0 -> removido
    expect(e).toEqual([{ kind: 'shield', remaining: 1 }]);
    expect(isEffectActive(e, 'magnet')).toBe(false);
    tickEffects(e); // shield 0 -> removido
    expect(e).toEqual([]);
  });

  it('cloneEffects is a deep copy', () => {
    const e: ActiveEffect[] = [{ kind: 'shield', remaining: 3 }];
    const c = cloneEffects(e);
    expect(c).toEqual(e);
    c[0]!.remaining = 99;
    expect(e[0]!.remaining).toBe(3);
  });
});
