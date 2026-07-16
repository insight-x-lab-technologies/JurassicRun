import { signal, computed, effect, type ReadonlySignal } from '@preact/signals';
import {
  initialLeaderboardState,
  recordMatch as recordMatchState,
  rankOf,
  MAX_ENTRIES,
  type LeaderboardEntry,
  type LeaderboardMode,
  type LeaderboardResult,
  type LeaderboardState,
} from './store';
import {
  localStorageLeaderboardStorage,
  memoryLeaderboardStorage,
  type LeaderboardStorage,
} from './storage';
import { toCentralEntries, type CentralEntry } from './central';
import type { LeaderboardOnline } from './online';
import type { OnlineScoreRow } from '@services/online/client';

const EMPTY_CENTRAL: readonly CentralEntry[] = [];

export class LeaderboardService {
  private storage: LeaderboardStorage = memoryLeaderboardStorage();
  private readonly _state = signal<LeaderboardState>(initialLeaderboardState());
  private readonly _central = signal<Record<LeaderboardMode, readonly CentralEntry[]>>({
    endless: EMPTY_CENTRAL, daily: EMPTY_CENTRAL, weekly: EMPTY_CENTRAL,
  });
  private online: LeaderboardOnline | null = null;
  private disposeEffect: (() => void) | null = null;
  private lastOnline = false;

  readonly endless: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.endless);
  readonly daily: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.daily);
  readonly weekly: ReadonlySignal<readonly LeaderboardEntry[]> = computed(() => this._state.value.weekly);
  readonly bestEndlessLevel: ReadonlySignal<number> = computed(() => this._state.value.bestEndlessLevel);

  readonly centralEndless: ReadonlySignal<readonly CentralEntry[]> = computed(() => this._central.value.endless);
  readonly centralDaily: ReadonlySignal<readonly CentralEntry[]> = computed(() => this._central.value.daily);
  readonly centralWeekly: ReadonlySignal<readonly CentralEntry[]> = computed(() => this._central.value.weekly);
  readonly centralAvailable: ReadonlySignal<boolean> = computed(() => this.online?.online.value ?? false);

  init(storage: LeaderboardStorage = localStorageLeaderboardStorage(), online?: LeaderboardOnline): void {
    this.storage = storage;
    this._state.value = storage.load();

    if (this.disposeEffect !== null) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this.online = online ?? null;
    this.lastOnline = false;
    this._central.value = { endless: EMPTY_CENTRAL, daily: EMPTY_CENTRAL, weekly: EMPTY_CENTRAL };

    if (this.online !== null) {
      const o = this.online;
      this.disposeEffect = effect(() => {
        const isOnline = o.online.value; // assina o sinal
        if (isOnline && !this.lastOnline) {
          this.lastOnline = true;
          void this.refreshCentral().catch(() => {}); // never throws (offline-first)
        } else if (!isOnline) {
          this.lastOnline = false;
        }
      });
    }
  }

  /** Registra o resultado de uma partida; persiste só se o estado mudou de ref. */
  recordMatch(r: LeaderboardResult): void {
    const next = recordMatchState(this._state.value, r);
    if (next !== this._state.value) {
      this._state.value = next;
      this.storage.save(next);
    }
    const o = this.online;
    if (o !== null && o.online.value) {
      void o.submitScore(r).then(() => this.refreshMode(r.mode)).catch(() => {}); // never throws
    }
  }

  /** Rank 1-based do recorde diário dessa seed; undefined se não houver. */
  dailyRankForSeed(seed: string): number | undefined {
    return rankOf(this._state.value.daily, seed);
  }

  /** Rank 1-based do jogador no board diário central da seed do `result` (undefined se offline/sem id/fora do board). */
  async centralDailyRank(result: LeaderboardResult): Promise<number | undefined> {
    const o = this.online;
    if (o === null || !o.online.value || result.mode !== 'daily') return undefined;
    const myId = o.playerId.value;
    if (myId === null) return undefined;
    const rows = await o.fetchScores('daily', result.seed);
    const synthetic: OnlineScoreRow = {
      playerId: myId, mode: 'daily', seed: result.seed, score: result.score,
      distance: result.distance, food: result.food, nearMisses: result.nearMisses,
      level: result.level, playerName: '', playerAvatar: '', createdAt: result.achievedAt,
    };
    const entries = toCentralEntries([...rows, synthetic], MAX_ENTRIES);
    const idx = entries.findIndex((e) => e.playerId === myId);
    return idx >= 0 ? idx + 1 : undefined;
  }

  private async refreshCentral(): Promise<void> {
    await Promise.all([
      this.refreshMode('endless'),
      this.refreshMode('daily'),
      this.refreshMode('weekly'),
    ]);
  }

  private async refreshMode(mode: LeaderboardMode): Promise<void> {
    const o = this.online;
    if (o === null || !o.online.value) return;
    const seed =
      mode === 'daily' ? o.currentSeeds().daily
      : mode === 'weekly' ? o.currentSeeds().weekly
      : undefined;
    const rows = await o.fetchScores(mode, seed);
    let entries = toCentralEntries(rows);
    if ((mode === 'daily' || mode === 'weekly') && seed !== undefined) {
      const verifiedIds = new Set(await o.fetchVerifiedPlayers(mode, seed));
      entries = entries.map((e) => ({ ...e, verified: verifiedIds.has(e.playerId) }));
    }
    this._central.value = { ...this._central.value, [mode]: entries };
  }
}

export const leaderboardService = new LeaderboardService();
export type { LeaderboardEntry, LeaderboardMode, LeaderboardResult } from './store';
export type { LeaderboardStorage } from './storage';
export type { CentralEntry } from './central';
