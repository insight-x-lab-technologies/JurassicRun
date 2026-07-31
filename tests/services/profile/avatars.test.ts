import { describe, it, expect } from 'vitest';
import {
  AVATAR_IDS,
  AVATARS,
  isAvatarId,
  defaultAvatarId,
  resolveAvatarId,
  avatarDef,
} from '@services/profile/avatars';

describe('catálogo de avatares', () => {
  it('tem 12 ids únicos', () => {
    expect(AVATAR_IDS).toHaveLength(12);
    expect(new Set(AVATAR_IDS).size).toBe(12);
    expect(AVATARS.map((a) => a.id)).toEqual([...AVATAR_IDS]);
  });

  it('cada avatar tem matiz própria dentro de [0, 360)', () => {
    const hues = AVATARS.map((a) => a.hue);
    expect(new Set(hues).size).toBe(hues.length);
    for (const h of hues) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it('isAvatarId aceita só ids do catálogo', () => {
    expect(isAvatarId('a01')).toBe(true);
    expect(isAvatarId('a99')).toBe(false);
    expect(isAvatarId(3)).toBe(false);
    expect(isAvatarId(undefined)).toBe(false);
  });

  it('defaultAvatarId é determinístico e sempre cai no catálogo', () => {
    const ids = ['abc', 'zzz-1', '', '9f8e7d6c-1111-2222-3333-444455556666'];
    for (const id of ids) {
      const a = defaultAvatarId(id);
      expect(AVATAR_IDS).toContain(a);
      expect(defaultAvatarId(id)).toBe(a); // estável entre chamadas
    }
  });

  it('defaultAvatarId distribui ids diferentes por avatares diferentes', () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => defaultAvatarId(`player-${i}`)),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('resolveAvatarId devolve o id válido e cai no default para lixo', () => {
    expect(resolveAvatarId('a05', 'p1')).toBe('a05');
    expect(resolveAvatarId('a99', 'p1')).toBe(defaultAvatarId('p1'));
    expect(resolveAvatarId(undefined, 'p1')).toBe(defaultAvatarId('p1'));
    expect(resolveAvatarId({ id: 'a01' }, 'p1')).toBe(defaultAvatarId('p1'));
  });

  it('avatarDef devolve a definição do id', () => {
    expect(avatarDef('a01').id).toBe('a01');
  });
});
