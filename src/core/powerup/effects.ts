import type { ActiveEffect, PowerupKind } from './types';

/** Ativa (ou estende) um efeito temporário. Re-pickup nunca encurta: remaining = max. */
export function activateEffect(effects: ActiveEffect[], kind: PowerupKind, durationSteps: number): void {
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i]!;
    if (e.kind === kind) {
      if (durationSteps > e.remaining) e.remaining = durationSteps;
      return;
    }
  }
  effects.push({ kind, remaining: durationSteps });
}

/** Decrementa todos os efeitos 1 step; remove os que expiram. 1×/step (no fim do step). */
export function tickEffects(effects: ActiveEffect[]): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]!;
    e.remaining -= 1;
    if (e.remaining <= 0) effects.splice(i, 1);
  }
}

/** Efeito do kind está ativo? Busca linear (array pequeno), sem alocação. */
export function isEffectActive(effects: readonly ActiveEffect[], kind: PowerupKind): boolean {
  for (let i = 0; i < effects.length; i++) {
    if (effects[i]!.kind === kind) return true;
  }
  return false;
}

/** Cópia profunda (para cloneWorld). */
export function cloneEffects(effects: readonly ActiveEffect[]): ActiveEffect[] {
  return effects.map((e) => ({ kind: e.kind, remaining: e.remaining }));
}
