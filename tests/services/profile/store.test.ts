import { describe, it, expect } from 'vitest';
import {
  emptyState,
  normalizeName,
  validateName,
  createProfile,
  setActive,
  renameProfile,
  setAvatar,
  activeProfile,
  avatarFor,
  NAME_MAX,
  type Profile,
} from '@services/profile/store';
import { defaultAvatarId, AVATAR_IDS } from '@services/profile/avatars';

describe('profile store — validação e normalização', () => {
  it('normalizeName faz trim e colapsa espaços internos', () => {
    expect(normalizeName('  Rex   the   King ')).toBe('Rex the King');
  });

  it('validateName rejeita vazio/só espaços', () => {
    expect(validateName('   ')).toEqual({ ok: false, error: 'empty' });
    expect(validateName('')).toEqual({ ok: false, error: 'empty' });
  });

  it('validateName rejeita nome longo demais (após normalizar)', () => {
    const long = 'x'.repeat(NAME_MAX + 1);
    expect(validateName(long)).toEqual({ ok: false, error: 'tooLong' });
  });

  it('validateName aceita e devolve o nome normalizado', () => {
    expect(validateName('  Ptero  ')).toEqual({ ok: true, name: 'Ptero' });
  });
});

describe('profile store — operações', () => {
  it('emptyState é vazio e sem ativo', () => {
    expect(emptyState()).toEqual({ profiles: [], activeId: null });
  });

  it('createProfile adiciona e torna o novo o ativo', () => {
    const { state, profile } = createProfile(emptyState(), 'id-1', 'Rex', 1000);
    expect(profile).toEqual({
      id: 'id-1',
      name: 'Rex',
      createdAt: 1000,
      avatarId: defaultAvatarId('id-1'),
    });
    expect(state.profiles).toEqual([profile]);
    expect(state.activeId).toBe('id-1');
  });

  it('createProfile deriva o avatar inicial do id', () => {
    const { profile } = createProfile(emptyState(), 'p1', 'Rex', 0);
    expect(profile.avatarId).toBe(defaultAvatarId('p1'));
    expect(AVATAR_IDS).toContain(profile.avatarId);
  });

  it('setAvatar troca só o perfil alvo', () => {
    let s = createProfile(emptyState(), 'p1', 'Rex', 0).state;
    s = createProfile(s, 'p2', 'Ptero', 0).state;
    const out = setAvatar(s, 'p1', 'a07');
    expect(out.profiles.find((p) => p.id === 'p1')!.avatarId).toBe('a07');
    expect(out.profiles.find((p) => p.id === 'p2')!.avatarId).toBe(defaultAvatarId('p2'));
  });

  it('setAvatar com id inexistente devolve o mesmo estado', () => {
    const s = createProfile(emptyState(), 'p1', 'Rex', 0).state;
    expect(setAvatar(s, 'nope', 'a07')).toBe(s);
  });

  it('createProfile preserva perfis anteriores e move o ativo para o novo', () => {
    const a = createProfile(emptyState(), 'id-1', 'A', 1).state;
    const b = createProfile(a, 'id-2', 'B', 2).state;
    expect(b.profiles.map((p) => p.id)).toEqual(['id-1', 'id-2']);
    expect(b.activeId).toBe('id-2');
  });

  it('setActive troca o ativo; no-op para id inexistente', () => {
    const base = createProfile(createProfile(emptyState(), 'id-1', 'A', 1).state, 'id-2', 'B', 2).state;
    expect(setActive(base, 'id-1').activeId).toBe('id-1');
    expect(setActive(base, 'nope').activeId).toBe('id-2');
  });

  it('renameProfile troca o nome; no-op para id inexistente', () => {
    const base = createProfile(emptyState(), 'id-1', 'A', 1).state;
    expect(renameProfile(base, 'id-1', 'Novo').profiles[0]!.name).toBe('Novo');
    expect(renameProfile(base, 'nope', 'X')).toEqual(base);
  });

  it('activeProfile devolve o ativo ou null', () => {
    expect(activeProfile(emptyState())).toBeNull();
    const s = createProfile(emptyState(), 'id-1', 'A', 1).state;
    expect(activeProfile(s)?.id).toBe('id-1');
  });
});

describe('profile store — avatarFor', () => {
  it('inicial é a 1ª letra maiúscula do nome', () => {
    expect(
      avatarFor({ id: 'id-1', name: 'rex', createdAt: 1, avatarId: defaultAvatarId('id-1') })
        .initial,
    ).toBe('R');
  });

  it('hue é determinístico por id e fica em [0,360)', () => {
    const p: Profile = {
      id: 'abc',
      name: 'Rex',
      createdAt: 1,
      avatarId: defaultAvatarId('abc'),
    } as const;
    const h1 = avatarFor(p).hue;
    const h2 = avatarFor({ ...p, name: 'Outro' }).hue; // hue depende do id, não do nome
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h1).toBeLessThan(360);
  });
});
