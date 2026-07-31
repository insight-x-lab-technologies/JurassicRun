// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  memoryProfileStorage,
  localStorageProfileStorage,
  STORAGE_KEY,
} from '@services/profile/storage';
import { emptyState, createProfile, type ProfileState } from '@services/profile/store';
import { defaultAvatarId } from '@services/profile/avatars';

function sample(): ProfileState {
  return createProfile(emptyState(), 'id-1', 'Rex', 1000).state;
}

describe('memoryProfileStorage', () => {
  it('round-trip: save depois load devolve o mesmo estado', () => {
    const s = memoryProfileStorage();
    s.save(sample());
    expect(s.load()).toEqual(sample());
  });

  it('load inicial (sem save) é emptyState', () => {
    expect(memoryProfileStorage().load()).toEqual(emptyState());
  });
});

describe('localStorageProfileStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trip via localStorage sob a chave versionada', () => {
    const s = localStorageProfileStorage();
    s.save(sample());
    expect(s.load()).toEqual(sample());
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(2);
  });

  it('chave ausente ⇒ emptyState', () => {
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });

  it('JSON inválido ⇒ emptyState (não lança)', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });

  it('forma inválida (profiles não-array) ⇒ emptyState', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, profiles: 'x', activeId: null }));
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });

  it('perfil malformado (campos do tipo errado) ⇒ emptyState', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, profiles: [{ id: 1, name: 'x', createdAt: 'y' }], activeId: null }),
    );
    expect(localStorageProfileStorage().load()).toEqual(emptyState());
  });

  it('perfis presentes mas activeId inválido ⇒ cai no primeiro perfil (não força re-onboarding)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        profiles: [
          { id: 'id-1', name: 'Rex', createdAt: 1000 },
          { id: 'id-2', name: 'Ptero', createdAt: 2000 },
        ],
        activeId: 'sumiu',
      }),
    );
    expect(localStorageProfileStorage().load().activeId).toBe('id-1');
  });

  it('payload legado (sem avatarId) carrega com avatar derivado', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, profiles: [{ id: 'p1', name: 'Rex', createdAt: 1 }], activeId: 'p1' }),
    );
    const state = localStorageProfileStorage().load();
    expect(state.profiles[0]!.avatarId).toBe(defaultAvatarId('p1'));
  });

  it('avatarId inválido cai no default', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        profiles: [{ id: 'p1', name: 'Rex', createdAt: 1, avatarId: 'a99' }],
        activeId: 'p1',
      }),
    );
    expect(localStorageProfileStorage().load().profiles[0]!.avatarId).toBe(defaultAvatarId('p1'));
  });

  it('round-trip preserva a escolha e grava version 2', () => {
    const storage = localStorageProfileStorage();
    storage.save({
      profiles: [{ id: 'p1', name: 'Rex', createdAt: 1, avatarId: 'a04' }],
      activeId: 'p1',
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(2);
    expect(storage.load().profiles[0]!.avatarId).toBe('a04');
  });

  it('a chave de storage NÃO muda (bumpar apagaria os perfis)', () => {
    expect(STORAGE_KEY).toBe('jurassicrun.profiles.v1');
  });
});
