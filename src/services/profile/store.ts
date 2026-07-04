export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
}

export interface ProfileState {
  readonly profiles: readonly Profile[];
  readonly activeId: string | null;
}

export type NameError = 'empty' | 'tooLong';
export type NameValidation = { ok: true; name: string } | { ok: false; error: NameError };

export const NAME_MAX = 20;

export function emptyState(): ProfileState {
  return { profiles: [], activeId: null };
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function validateName(raw: string): NameValidation {
  const name = normalizeName(raw);
  if (name.length === 0) return { ok: false, error: 'empty' };
  if (name.length > NAME_MAX) return { ok: false, error: 'tooLong' };
  return { ok: true, name };
}

export function createProfile(
  state: ProfileState,
  id: string,
  name: string,
  createdAt: number,
): { state: ProfileState; profile: Profile } {
  const profile: Profile = { id, name, createdAt };
  return {
    state: { profiles: [...state.profiles, profile], activeId: id },
    profile,
  };
}

export function setActive(state: ProfileState, id: string): ProfileState {
  if (!state.profiles.some((p) => p.id === id)) return state;
  return { ...state, activeId: id };
}

export function renameProfile(state: ProfileState, id: string, name: string): ProfileState {
  if (!state.profiles.some((p) => p.id === id)) return state;
  return {
    ...state,
    profiles: state.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
  };
}

export function activeProfile(state: ProfileState): Profile | null {
  if (state.activeId === null) return null;
  return state.profiles.find((p) => p.id === state.activeId) ?? null;
}

export function avatarFor(profile: Profile): { initial: string; hue: number } {
  const initial = profile.name.trim().charAt(0).toUpperCase() || '?';
  let h = 0;
  for (let i = 0; i < profile.id.length; i++) {
    h = (h * 31 + profile.id.charCodeAt(i)) >>> 0;
  }
  return { initial, hue: h % 360 };
}
