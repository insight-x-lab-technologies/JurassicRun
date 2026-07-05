import type { DinoTrait, TraitModifiers } from './types';

/** Duração (steps) do escudo inicial do traço headStart. Placeholder de tuning. */
export const HEAD_START_SHIELD_STEPS = 180;

const NEUTRAL: TraitModifiers = { magnetAlways: false, foodMultiplier: 1, startExtraLives: 0, startShieldSteps: 0 };

/** Catálogo congelado: trait → modificadores. Referências estáveis (alocação-zero no hot path). */
export const TRAIT_CATALOG: Readonly<Record<DinoTrait, TraitModifiers>> = Object.freeze({
  none: Object.freeze({ ...NEUTRAL }),
  magnet: Object.freeze({ ...NEUTRAL, magnetAlways: true }),
  doubleFood: Object.freeze({ ...NEUTRAL, foodMultiplier: 2 }),
  tripleFood: Object.freeze({ ...NEUTRAL, foodMultiplier: 3 }),
  startLife: Object.freeze({ ...NEUTRAL, startExtraLives: 1 }),
  headStart: Object.freeze({ ...NEUTRAL, startShieldSteps: HEAD_START_SHIELD_STEPS }),
});

export const DINO_TRAITS: readonly DinoTrait[] = Object.freeze([
  'none', 'magnet', 'doubleFood', 'tripleFood', 'startLife', 'headStart',
]);

/** Lookup alocação-zero: retorna a referência congelada do catálogo. */
export function traitModifiers(trait: DinoTrait): TraitModifiers {
  return TRAIT_CATALOG[trait];
}
