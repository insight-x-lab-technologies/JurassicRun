import { signal, computed, effect, type ReadonlySignal } from '@preact/signals';
import { profileService, avatarFor, type Profile } from '@services/profile';
import { onlineConfig, type OnlineConfig } from './config';
import {
  createSupabaseClient,
  type OnlineClient,
  type OnlinePlayer,
  type OnlineScoreInput,
  type OnlineScoreRow,
  type OnlineMode,
  type OnlineChallengeInput,
} from './client';

export type OnlineStatus = 'offline' | 'connecting' | 'online' | 'error';

interface ProfileLike {
  readonly activeProfile: ReadonlySignal<Profile | null>;
}

export interface OnlineInitDeps {
  config?: OnlineConfig | null;
  client?: OnlineClient | null;
  profile?: ProfileLike;
}

function signatureOf(p: OnlinePlayer): string {
  return `${p.id}|${p.name}|${p.avatar}`;
}

export class OnlineService {
  private readonly _id = signal<string | null>(null);
  private readonly _status = signal<OnlineStatus>('offline');
  private client: OnlineClient | null = null;
  private profile: ProfileLike = profileService;
  private lastSignature: string | null = null;
  private disposeEffect: (() => void) | null = null;

  readonly globalPlayerId: ReadonlySignal<string | null> = computed(() => this._id.value);
  readonly status: ReadonlySignal<OnlineStatus> = computed(() => this._status.value);
  readonly online: ReadonlySignal<boolean> = computed(() => this._status.value === 'online');

  async submitScore(input: Omit<OnlineScoreInput, 'playerId'>): Promise<void> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return;
    try {
      await this.client.submitScore({ ...input, playerId: id });
    } catch {
      // best-effort: falha de rede não derruba o status
    }
  }

  async fetchScores(mode: OnlineMode, seed?: string): Promise<readonly OnlineScoreRow[]> {
    if (this._status.value !== 'online' || this.client === null) return [];
    try {
      return await this.client.fetchScores(mode, seed);
    } catch {
      return [];
    }
  }

  async submitChallengeEntry(input: Omit<OnlineChallengeInput, 'playerId'>): Promise<void> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return;
    try {
      await this.client.submitChallengeEntry({ ...input, playerId: id });
    } catch {
      // best-effort
    }
  }

  async fetchVerifiedPlayers(mode: OnlineMode, seed: string): Promise<readonly string[]> {
    if (this._status.value !== 'online' || this.client === null) return [];
    try {
      return await this.client.fetchVerifiedPlayers(mode, seed);
    } catch {
      return [];
    }
  }

  async submitTrophies(ids: readonly string[]): Promise<void> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return;
    if (ids.length === 0) return;
    try {
      await this.client.submitTrophies(id, ids);
    } catch {
      // best-effort
    }
  }

  async fetchTrophies(): Promise<readonly string[]> {
    const id = this._id.value;
    if (this._status.value !== 'online' || id === null || this.client === null) return [];
    try {
      return await this.client.fetchTrophies(id);
    } catch {
      return [];
    }
  }

  async init(deps: OnlineInitDeps = {}): Promise<void> {
    // Reentrante: descarta a assinatura de perfil anterior.
    if (this.disposeEffect !== null) {
      this.disposeEffect();
      this.disposeEffect = null;
    }
    this._id.value = null;
    this.lastSignature = null;

    const config = deps.config !== undefined ? deps.config : onlineConfig();
    const client =
      deps.client !== undefined
        ? deps.client
        : config !== null
          ? createSupabaseClient(config)
          : null;
    this.profile = deps.profile ?? profileService;
    this.client = client;

    if (config === null || client === null) {
      this._status.value = 'offline';
      return;
    }

    this._status.value = 'connecting';
    try {
      const uid = await client.signInAnonymously();
      this._id.value = uid;
      this._status.value = 'online';
      this.syncActiveProfile();
      // Re-sincroniza ao trocar/renomear o perfil ativo.
      this.disposeEffect = effect(() => {
        // lê o sinal p/ assinar; a lógica de dedup evita upsert redundante
        void this.profile.activeProfile.value;
        this.syncActiveProfile();
      });
    } catch {
      this._id.value = null;
      this._status.value = 'error';
    }
  }

  private syncActiveProfile(): void {
    if (this._status.value !== 'online') return;
    const id = this._id.value;
    if (id === null) return;
    const active = this.profile.activeProfile.value;
    if (active === null) return;
    const { hue } = avatarFor(active);
    const player: OnlinePlayer = { id, name: active.name, avatar: String(hue) };
    const sig = signatureOf(player);
    if (sig === this.lastSignature) return;
    this.lastSignature = sig;
    void this.client?.upsertPlayer(player).catch(() => {
      // best-effort: falha de rede não derruba o status nem propaga
    });
  }
}

export const onlineService = new OnlineService();
export type { OnlineConfig } from './config';
export type { OnlineScoreInput, OnlineScoreRow, OnlineMode, OnlineChallengeInput } from './client';
