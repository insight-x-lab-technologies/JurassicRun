import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  initialReplayState,
  recordReplay,
  type ReplayState,
  type StoredReplay,
} from './store';
import { verifyReplay, type ReplayVerification } from './verify';
import {
  localStorageReplayStorage,
  memoryReplayStorage,
  type ReplayStorage,
} from './storage';

/**
 * Serviço reativo de replays verificáveis (molde do leaderboard). Grava seed+timeline+hash da
 * melhor tentativa de cada desafio e expõe a verificação de integridade (seam da Fase 6).
 */
export class ReplayService {
  private storage: ReplayStorage = memoryReplayStorage();
  private readonly _state = signal<ReplayState>(initialReplayState());

  readonly daily: ReadonlySignal<readonly StoredReplay[]> = computed(() => this._state.value.daily);
  readonly weekly: ReadonlySignal<readonly StoredReplay[]> = computed(() => this._state.value.weekly);

  init(storage: ReplayStorage = localStorageReplayStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  /** Grava um replay; persiste só se o estado mudou de ref (no-op periódico não salva). */
  record(replay: StoredReplay): void {
    const next = recordReplay(this._state.value, replay);
    if (next === this._state.value) return;
    this._state.value = next;
    this.storage.save(next);
  }

  /** Re-simula e verifica a integridade do replay (delega ao verificador puro). */
  verify(replay: StoredReplay): ReplayVerification {
    return verifyReplay(replay);
  }
}

export const replayService = new ReplayService();

export { verifyReplay } from './verify';
export type { ReplayVerification } from './verify';
export type { StoredReplay, ReplayMode, ReplayState } from './store';
export type { ReplayStorage } from './storage';
