import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialEntitlementsState,
  unlock as unlockState,
  setActive,
  type EntitlementsState,
  type UnlockResult,
} from './store';
import { expansionById, DEFAULT_EXPANSION_ID, type ExpansionDef } from './catalog';
import {
  localStorageEntitlementsStorage,
  memoryEntitlementsStorage,
  type EntitlementsStorage,
} from './storage';
import { honorSystemProvider, type EntitlementProvider } from './provider';

class EntitlementsService {
  private storage: EntitlementsStorage = memoryEntitlementsStorage();
  private provider: EntitlementProvider = honorSystemProvider;
  private readonly _state = signal<EntitlementsState>(initialEntitlementsState());

  readonly unlockedIds: ReadonlySignal<readonly string[]> = computed(
    () => this._state.value.unlocked,
  );
  /** SEAM da Fase 8: o render lê a expansão ativa daqui. Sempre um ExpansionDef válido. */
  readonly activeExpansion: ReadonlySignal<ExpansionDef> = computed(
    () => expansionById(this._state.value.activeId) ?? expansionById(DEFAULT_EXPANSION_ID)!,
  );

  init(
    storage: EntitlementsStorage = localStorageEntitlementsStorage(),
    provider: EntitlementProvider = honorSystemProvider,
  ): void {
    this.storage = storage;
    this.provider = provider;
    this._state.value = storage.load();
  }

  /** Solicita o desbloqueio via provider; só aplica/persiste em 'granted'. */
  unlock(id: string): UnlockResult {
    if (this.provider.requestUnlock(id) !== 'granted') return 'unknown';
    const { state, result } = unlockState(this._state.value, id);
    if (result === 'ok') this.commit(state);
    return result;
  }

  select(id: string): void {
    this.commit(setActive(this._state.value, id));
  }

  private commit(state: EntitlementsState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const entitlementsService = new EntitlementsService();
export { EXPANSION_CATALOG, DEFAULT_EXPANSION_ID, expansionById } from './catalog';
export type { ExpansionDef, ExpansionTier } from './catalog';
export { isUnlocked, type EntitlementsState, type UnlockResult } from './store';
