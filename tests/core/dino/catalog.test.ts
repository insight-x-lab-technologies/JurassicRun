import { describe, it, expect } from 'vitest';
import { traitModifiers, DINO_TRAITS, HEAD_START_SHIELD_STEPS } from '@core/dino';

describe('traitModifiers', () => {
  it('none é o baseline neutro', () => {
    expect(traitModifiers('none')).toEqual({
      magnetAlways: false, foodMultiplier: 1, startExtraLives: 0, startShieldSteps: 0,
    });
  });

  it('magnet liga o ímã permanente e mantém o resto neutro', () => {
    const m = traitModifiers('magnet');
    expect(m.magnetAlways).toBe(true);
    expect(m.foodMultiplier).toBe(1);
    expect(m.startExtraLives).toBe(0);
    expect(m.startShieldSteps).toBe(0);
  });

  it('doubleFood/tripleFood setam o multiplicador de comida', () => {
    expect(traitModifiers('doubleFood').foodMultiplier).toBe(2);
    expect(traitModifiers('tripleFood').foodMultiplier).toBe(3);
  });

  it('startLife dá 1 vida extra inicial', () => {
    expect(traitModifiers('startLife').startExtraLives).toBe(1);
  });

  it('headStart dá escudo inicial de HEAD_START_SHIELD_STEPS steps', () => {
    expect(HEAD_START_SHIELD_STEPS).toBeGreaterThan(0);
    expect(traitModifiers('headStart').startShieldSteps).toBe(HEAD_START_SHIELD_STEPS);
  });

  it('todo trait tem entrada e o lookup é estável (mesma referência congelada)', () => {
    for (const t of DINO_TRAITS) {
      const a = traitModifiers(t);
      expect(a).toBe(traitModifiers(t)); // referência estável ⇒ alocação-zero
      expect(Object.isFrozen(a)).toBe(true);
    }
  });
});
