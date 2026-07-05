import { DINO_ROSTER, STARTER_DINO_ID, dinoById, type DinoDef } from './roster';

export interface NestState {
  readonly owned: readonly string[];
  readonly activeId: string;
}

export type PurchaseResult = 'ok' | 'alreadyOwned' | 'insufficient' | 'unknown';

export function initialNestState(): NestState {
  return { owned: [STARTER_DINO_ID], activeId: STARTER_DINO_ID };
}

export function isOwned(state: NestState, id: string): boolean {
  return state.owned.includes(id);
}

export function ownedDinos(state: NestState): readonly DinoDef[] {
  return DINO_ROSTER.filter((d) => state.owned.includes(d.id));
}

export function setActive(state: NestState, id: string): NestState {
  if (!isOwned(state, id)) return state;
  return { ...state, activeId: id };
}

export function purchase(
  state: NestState,
  id: string,
  balance: number,
): { state: NestState; result: PurchaseResult; spent: number } {
  const def = dinoById(id);
  if (!def) return { state, result: 'unknown', spent: 0 };
  if (isOwned(state, id)) return { state, result: 'alreadyOwned', spent: 0 };
  if (balance < def.price) return { state, result: 'insufficient', spent: 0 };
  return { state: { ...state, owned: [...state.owned, id] }, result: 'ok', spent: def.price };
}
