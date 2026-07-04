// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { profileService } from '@services/profile';
import { memoryProfileStorage } from '@services/profile/storage';
import { emptyState } from '@services/profile/store';

describe('ProfileService', () => {
  beforeEach(() => {
    profileService.init(memoryProfileStorage(emptyState()));
  });

  it('começa sem perfis e sem ativo', () => {
    expect(profileService.profiles.value).toEqual([]);
    expect(profileService.activeProfile.value).toBeNull();
  });

  it('create adiciona, ativa e devolve true; gera id e createdAt', () => {
    expect(profileService.create('Rex')).toBe(true);
    expect(profileService.profiles.value).toHaveLength(1);
    const active = profileService.activeProfile.value!;
    expect(active.name).toBe('Rex');
    expect(typeof active.id).toBe('string');
    expect(active.id.length).toBeGreaterThan(0);
    expect(typeof active.createdAt).toBe('number');
  });

  it('create com nome inválido devolve false e não muta', () => {
    expect(profileService.create('   ')).toBe(false);
    expect(profileService.profiles.value).toEqual([]);
  });

  it('create normaliza o nome', () => {
    profileService.create('  Ptero  Two ');
    expect(profileService.activeProfile.value!.name).toBe('Ptero Two');
  });

  it('switchTo troca o ativo', () => {
    profileService.create('A');
    const idA = profileService.activeProfile.value!.id;
    profileService.create('B');
    profileService.switchTo(idA);
    expect(profileService.activeProfile.value!.name).toBe('A');
  });

  it('renameActive renomeia o ativo e devolve true; inválido devolve false', () => {
    profileService.create('A');
    expect(profileService.renameActive('Novo')).toBe(true);
    expect(profileService.activeProfile.value!.name).toBe('Novo');
    expect(profileService.renameActive('  ')).toBe(false);
    expect(profileService.activeProfile.value!.name).toBe('Novo');
  });

  it('persiste: um novo service com o mesmo storage recarrega o estado', () => {
    const storage = memoryProfileStorage(emptyState());
    profileService.init(storage);
    profileService.create('Rex');
    // reinicializa a partir do mesmo storage
    profileService.init(storage);
    expect(profileService.profiles.value).toHaveLength(1);
    expect(profileService.activeProfile.value!.name).toBe('Rex');
  });
});
