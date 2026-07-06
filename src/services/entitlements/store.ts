import { DEFAULT_EXPANSION_ID, expansionById } from './catalog';

export interface EntitlementsState {
  readonly unlocked: readonly string[]; // sempre inclui DEFAULT_EXPANSION_ID
  readonly activeId: string;            // sempre um id desbloqueado
}

export type UnlockResult = 'ok' | 'alreadyUnlocked' | 'unknown';

export function initialEntitlementsState(): EntitlementsState {
  return { unlocked: [DEFAULT_EXPANSION_ID], activeId: DEFAULT_EXPANSION_ID };
}

export function isUnlocked(state: EntitlementsState, id: string): boolean {
  return state.unlocked.includes(id);
}

/** Desbloqueia uma expansão do catálogo. Idempotente. NÃO ativa. Imutável. */
export function unlock(
  state: EntitlementsState,
  id: string,
): { state: EntitlementsState; result: UnlockResult } {
  if (expansionById(id) === undefined) return { state, result: 'unknown' };
  if (isUnlocked(state, id)) return { state, result: 'alreadyUnlocked' };
  return { state: { ...state, unlocked: [...state.unlocked, id] }, result: 'ok' };
}

/** Ativa uma expansão desbloqueada; no-op (retorna o mesmo estado) se não estiver. */
export function setActive(state: EntitlementsState, id: string): EntitlementsState {
  if (!isUnlocked(state, id)) return state;
  return { ...state, activeId: id };
}
