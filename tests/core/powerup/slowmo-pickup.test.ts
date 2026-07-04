import { describe, it, expect } from 'vitest';
import { createWorld } from '@core/sim';
import type { Entity } from '@core/sim';
import {
  pickupPowerup,
  tickEffects,
  isEffectActive,
  SLOW_MO_DURATION_STEPS,
} from '@core/powerup';
import { circle } from '@core/sim/hitbox';

function slowMoPickup(): Entity {
  return {
    id: 0,
    type: 'collectible',
    tags: ['powerup.slowMo'],
    transform: { position: { x: 0, y: 0 } },
    kinematics: { velocity: { x: 0, y: 0 } },
    hitbox: circle(8),
  };
}

describe('slow-mo pickup', () => {
  it('ativa o efeito slowMo por SLOW_MO_DURATION_STEPS e expira depois', () => {
    const w = createWorld({ worldHeight: 600, startY: 300 });
    const p = slowMoPickup();
    w.powerups.push(p);

    expect(pickupPowerup(w, p)).toBe(true);
    expect(w.powerups).toHaveLength(0);
    expect(isEffectActive(w.effects, 'slowMo')).toBe(true);

    // Ticka até 1 antes de expirar: ainda ativo.
    for (let i = 0; i < SLOW_MO_DURATION_STEPS - 1; i++) tickEffects(w.effects);
    expect(isEffectActive(w.effects, 'slowMo')).toBe(true);
    // Último tick: expira.
    tickEffects(w.effects);
    expect(isEffectActive(w.effects, 'slowMo')).toBe(false);
  });
});
