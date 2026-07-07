import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialLeaderboardState,
  recordMatch as recordMatchState,
  type LeaderboardEntry,
  type LeaderboardResult,
  type LeaderboardState,
} from './store';
import {
  localStorageLeaderboardStorage,
  memoryLeaderboardStorage,
  type LeaderboardStorage,
} from './storage';

export class LeaderboardService {
  private storage: LeaderboardStorage = memoryLeaderboardStorage();
  private readonly _state = signal<LeaderboardState>(initialLeaderboardState());

  readonly endless: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.endless);
  readonly daily: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.daily);
  readonly weekly: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.weekly);
  readonly bestEndlessLevel: ReadonlySignal<number> = computed(() => this._state.value.bestEndlessLevel);

  init(storage: LeaderboardStorage = localStorageLeaderboardStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Registra o resultado de uma partida; persiste só se o estado mudou de ref. */
  recordMatch(r: LeaderboardResult): void {
    const next = recordMatchState(this._state.value, r);
    if (next === this._state.value) return; // no-op ⇒ nada a fazer
    this._state.value = next;
    this.storage.save(next);
  }
}

export const leaderboardService = new LeaderboardService();
export type { LeaderboardEntry, LeaderboardMode, LeaderboardResult } from './store';
export type { LeaderboardStorage } from './storage';
