/**
 * Catálogo de avatares de perfil (10.6).
 *
 * Namespace PRÓPRIO, deliberadamente opaco: reusar os ids do `DINO_ROSTER` acoplaria identidade de
 * jogador a traços/entitlements. O `hue` é o fallback visual (disco colorido) quando o PNG do
 * avatar não carrega; a arte real vive em `public/ui/avatar.<id>.png`.
 */
export const AVATAR_IDS = [
  'a01', 'a02', 'a03', 'a04', 'a05', 'a06',
  'a07', 'a08', 'a09', 'a10', 'a11', 'a12',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export interface AvatarDef {
  readonly id: AvatarId;
  readonly hue: number;
}

export const AVATARS: readonly AvatarDef[] = AVATAR_IDS.map((id, i) => ({
  id,
  hue: i * 30,
}));

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value);
}

/** Hash estável de string (mesma função que `avatarFor` usava): id igual ⇒ avatar igual em
 * qualquer aparelho, sem depender de RNG nem de relógio. */
export function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function defaultAvatarId(profileId: string): AvatarId {
  return AVATAR_IDS[hashId(profileId) % AVATAR_IDS.length]!;
}

/** Normaliza o que veio do storage: id do catálogo passa; qualquer outra coisa cai no default. */
export function resolveAvatarId(raw: unknown, profileId: string): AvatarId {
  return isAvatarId(raw) ? raw : defaultAvatarId(profileId);
}

export function avatarDef(id: AvatarId): AvatarDef {
  return AVATARS[AVATAR_IDS.indexOf(id)]!;
}
