import { signal, computed, effect, type ReadonlySignal } from '@preact/signals';
import {
  initialTrophyState,
  recordMatch as recordMatchState,
  evaluate,
  type MatchSummary,
  type TrophyState,
} from './store';
import { localStorageTrophyStorage, memoryTrophyStorage, type TrophyStorage } from './storage';
import { isKnownTrophyId } from './catalog';
import type { TrophyOnline } from './online';

export class TrophyService {
  private storage: TrophyStorage = memoryTrophyStorage();
  private readonly _state = signal<TrophyState>(initialTrophyState());
  private online: TrophyOnline | null = null;
  private disposeEffect: (() => void) | null = null;
  private lastOnline = false;

  readonly unlockedIds: ReadonlySignal<readonly string[]> = computed(() => this._state.value.unlocked);
  readonly unlockedCount: ReadonlySignal<number> = computed(() => this._state.value.unlocked.length);

  init(storage: TrophyStorage = localStorageTrophyStorage(), online?: TrophyOnline): void {
    this.storage = storage;
    this._state.value = storage.load();

    if (this.disposeEffect !== null) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.online = online ?? null;
    this.lastOnline = false;

    if (this.online !== null) {
      const o = this.online;
      this.disposeEffect = effect(() => {
        const isOnline = o.online.value; // assina
        if (isOnline && !this.lastOnline) {
          this.lastOnline = true;
          void this.mergeFromServer().catch(() => {}); // offline-first
        } else if (!isOnline) {
          this.lastOnline = false;
        }
      });
    }
  }

  /** Registra o resultado de uma partida; persiste se algo mudou. Retorna os ids recém-desbloqueados. */
  recordMatch(m: MatchSummary, extra?: { readonly dailyRank?: number }): readonly string[] {
    const { state, newlyUnlocked } = recordMatchState(this._state.value, m, extra);
    this.commit(state); // stats sempre mudam (gamesPlayed++) ⇒ sempre persiste
    this.pushToServer(newlyUnlocked);
    return newlyUnlocked;
  }

  /** Reavalia só o pódio diário com o rank central. Push best-effort. */
  recordDailyPodium(dailyRank: number): readonly string[] {
    const { state, newlyUnlocked } = evaluate(this._state.value, {
      stats: this._state.value.stats,
      dailyRank,
    });
    if (newlyUnlocked.length > 0) {
      this.commit(state);
      this.pushToServer(newlyUnlocked);
    }
    return newlyUnlocked;
  }

  private pushToServer(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const o = this.online;
    if (o === null || !o.online.value) return;
    void o.submitTrophies(ids).catch(() => {}); // best-effort
  }

  private async mergeFromServer(): Promise<void> {
    const o = this.online;
    if (o === null || !o.online.value) return;
    const server = (await o.fetchTrophies()).filter(isKnownTrophyId);
    const local = this._state.value.unlocked;
    const union = [...new Set([...local, ...server])];
    if (union.length > local.length) {
      this.commit({ ...this._state.value, unlocked: union });
    }
    const localOnly = local.filter((id) => !server.includes(id));
    if (localOnly.length > 0) {
      void o.submitTrophies(localOnly).catch(() => {});
    }
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
export type { TrophyOnline } from './online';
