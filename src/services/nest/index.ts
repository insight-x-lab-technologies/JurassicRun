import { signal, computed, type ReadonlySignal } from '@preact/signals';
import type { DinoTrait } from '@core/dino';
import {
  initialNestState,
  setActive,
  purchase,
  type NestState,
  type PurchaseResult,
} from './store';
import { dinoById, STARTER_DINO_ID, type DinoDef } from './roster';
import { localStorageNestStorage, memoryNestStorage, type NestStorage } from './storage';
import { walletService } from '@services/wallet';

class NestService {
  private storage: NestStorage = memoryNestStorage();
  private readonly _state = signal<NestState>(initialNestState());

  readonly ownedIds: ReadonlySignal<readonly string[]> = computed(() => this._state.value.owned);
  readonly activeDino: ReadonlySignal<DinoDef> = computed(
    () => dinoById(this._state.value.activeId) ?? dinoById(STARTER_DINO_ID)!,
  );

  init(storage: NestStorage = localStorageNestStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  select(id: string): void {
    this.commit(setActive(this._state.value, id));
  }

  buy(id: string): PurchaseResult {
    const { state, result, spent } = purchase(this._state.value, id, walletService.balance.value);
    if (result === 'ok') {
      if (!walletService.spend(spent)) return 'insufficient'; // guarda extra contra corrida
      this.commit(state);
    }
    return result;
  }

  activeTrait(): DinoTrait {
    return this.activeDino.value.traitKind;
  }

  private commit(state: NestState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const nestService = new NestService();
export type { DinoDef } from './roster';
export { DINO_ROSTER, STARTER_DINO_ID, dinoById } from './roster';
export { isOwned, ownedDinos, type NestState, type PurchaseResult } from './store';
