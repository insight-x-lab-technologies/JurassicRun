// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  memoryProfileStorage,
  localStorageProfileStorage,
  STORAGE_KEY,
} from '@services/profile/storage';
import { emptyState, createProfile, type ProfileState } from '@services/profile/store';

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
    expect(raw.version).toBe(1);
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
});
