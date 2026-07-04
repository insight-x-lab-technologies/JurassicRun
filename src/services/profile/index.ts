import { signal, computed, type ReadonlySignal } from '@preact/signals';
import {
  emptyState,
  activeProfile as pickActive,
  createProfile,
  setActive,
  renameProfile,
  validateName,
  avatarFor,
  type Profile,
  type ProfileState,
  type NameValidation,
} from './store';
import {
  localStorageProfileStorage,
  memoryProfileStorage,
  type ProfileStorage,
} from './storage';

class ProfileService {
  private storage: ProfileStorage = memoryProfileStorage();
  private readonly _state = signal<ProfileState>(emptyState());

  readonly profiles: ReadonlySignal<readonly Profile[]> = computed(
    () => this._state.value.profiles,
  );
  readonly activeProfile: ReadonlySignal<Profile | null> = computed(() =>
    pickActive(this._state.value),
  );

  init(storage: ProfileStorage = localStorageProfileStorage()): void {
    this.storage = storage;
    this._state.value = storage.load();
  }

  create(rawName: string): boolean {
    const v = validateName(rawName);
    if (!v.ok) return false;
    const id = crypto.randomUUID();
    const { state } = createProfile(this._state.value, id, v.name, Date.now());
    this.commit(state);
    return true;
  }

  switchTo(id: string): void {
    this.commit(setActive(this._state.value, id));
  }

  renameActive(rawName: string): boolean {
    const id = this._state.value.activeId;
    if (id === null) return false;
    const v = validateName(rawName);
    if (!v.ok) return false;
    this.commit(renameProfile(this._state.value, id, v.name));
    return true;
  }

  validateName(raw: string): NameValidation {
    return validateName(raw);
  }

  private commit(state: ProfileState): void {
    this._state.value = state;
    this.storage.save(state);
  }
}

export const profileService = new ProfileService();
export { avatarFor };
export type { Profile, NameError, NameValidation } from './store';
