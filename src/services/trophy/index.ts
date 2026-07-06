import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialTrophyState,
  recordMatch as recordMatchState,
  type MatchSummary,
  type TrophyState,
} from './store';
import { localStorageTrophyStorage, memoryTrophyStorage, type TrophyStorage } from './storage';

export class TrophyService {
  private storage: TrophyStorage = memoryTrophyStorage();
  private readonly _state = signal<TrophyState>(initialTrophyState());

  readonly unlockedIds: ReadonlySignal<readonly string[]> = computed(() => this._state.value.unlocked);
  readonly unlockedCount: ReadonlySignal<number> = computed(() => this._state.value.unlocked.length);

  init(storage: TrophyStorage = localStorageTrophyStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Registra o resultado de uma partida; persiste se algo mudou. Retorna os ids recém-desbloqueados. */
  recordMatch(m: MatchSummary): readonly string[] {
    const { state, newlyUnlocked } = recordMatchState(this._state.value, m);
    this.commit(state); // stats sempre mudam (gamesPlayed++) ⇒ sempre persiste
    return newlyUnlocked;
  }

  private commit(state: TrophyState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const trophyService = new TrophyService();
export { TROPHY_CATALOG, trophyById } from './catalog';
export type { TrophyDef } from './catalog';
export type { MatchSummary } from './store';
export type { TrophyStorage } from './storage';
