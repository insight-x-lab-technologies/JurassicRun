import { signal, computed, effect, type ReadonlySignal } from '@preact/signals';
import {
  initialTrophyState,
  recordMatch as recordMatchState,
  evaluate,
  foldPodium,
  type MatchSummary,
  type TrophyState,
  type TrophyStats,
} from './store';
import { localStorageTrophyStorage, memoryTrophyStorage, type TrophyStorage } from './storage';
import { isKnownTrophyId, PODIUM_RANK } from './catalog';
import type { TrophyOnline } from './online';

export class TrophyService {
  private storage: TrophyStorage = memoryTrophyStorage();
  private readonly _state = signal<TrophyState>(initialTrophyState());
  private online: TrophyOnline | null = null;
  private disposeEffect: (() => void) | null = null;
  private lastOnline = false;

  readonly unlockedIds: ReadonlySignal<readonly string[]> = computed(() => this._state.value.unlocked);
  readonly unlockedCount: ReadonlySignal<number> = computed(() => this._state.value.unlocked.length);
  /** Agregado vitalício (10.7): telas de progresso leem daqui. */
  readonly stats: ReadonlySignal<TrophyStats> = computed(() => this._state.value.stats);

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
  recordMatch(
    m: MatchSummary,
    extra?: { readonly dailyRank?: number; readonly weeklyRank?: number },
  ): readonly string[] {
    const { state, newlyUnlocked } = recordMatchState(this._state.value, m, extra);
    this.commit(state); // stats sempre mudam (gamesPlayed++) ⇒ sempre persiste
    this.pushToServer(newlyUnlocked);
    return newlyUnlocked;
  }

  /**
   * Reavalia o pódio diário com o rank CENTRAL (chega assíncrono). Push best-effort.
   *
   * INVARIANTE: este caminho e o `extra.dailyRank` de `recordMatch` contam o MESMO pódio.
   * `startGame` usa o rank local só quando o board central está indisponível e o central só
   * quando está — nunca os dois para a mesma partida.
   */
  recordDailyPodium(dailyRank: number): readonly string[] {
    if (dailyRank > PODIUM_RANK) return [];
    const stats = foldPodium(this._state.value.stats, 'daily');
    const { state, newlyUnlocked } = evaluate(
      { stats, unlocked: this._state.value.unlocked },
      { stats, dailyRank },
    );
    this.commit(state); // o agregado mudou (dailyPodiums++) ⇒ persiste sempre
    this.pushToServer(newlyUnlocked);
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
