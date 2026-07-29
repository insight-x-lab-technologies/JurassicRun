import { describe, it, expect } from 'vitest';
import { POWERUP_CATALOG, powerupKindForTag } from '@core/powerup';
import { createRng } from '@core/rng';

describe('powerup catalog', () => {
  it('has the 5 power-up types, all floating with a circle hitbox', () => {
    const ids = POWERUP_CATALOG.map((t) => t.id);
    expect(ids).toEqual([
      'powerup.shield',
      'powerup.extraLife',
      'powerup.magnet',
      'powerup.doubleCoin',
      'powerup.slowMo',
    ]);
    const rng = createRng('endless:CAT');
    for (const t of POWERUP_CATALOG) {
      expect(t.anchor).toBe('floating');
      expect(t.makeHitbox(rng).kind).toBe('circle');
    }
  });

  it('powerupKindForTag maps ids to kinds and null otherwise', () => {
    expect(powerupKindForTag('powerup.shield')).toBe('shield');
    expect(powerupKindForTag('powerup.extraLife')).toBe('extraLife');
    expect(powerupKindForTag('powerup.magnet')).toBe('magnet');
    expect(powerupKindForTag('powerup.doubleCoin')).toBe('doubleCoin');
    expect(powerupKindForTag('powerup.slowMo')).toBe('slowMo');
    expect(powerupKindForTag('obstacle.tree')).toBeNull();
    expect(powerupKindForTag('bird.coin')).toBeNull();
  });
});
