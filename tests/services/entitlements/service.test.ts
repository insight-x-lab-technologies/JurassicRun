import { describe, it, expect, beforeEach } from 'vitest';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';
import { DEFAULT_EXPANSION_ID } from '@services/entitlements/catalog';
import type { EntitlementProvider } from '@services/entitlements/provider';

const decliningProvider: EntitlementProvider = { requestUnlock: () => 'declined' };

describe('EntitlementsService', () => {
  beforeEach(() => {
    entitlementsService.init(memoryEntitlementsStorage());
  });

  it('inicia com a expansão default ativa e desbloqueada', () => {
    expect(entitlementsService.activeExpansion.value.id).toBe(DEFAULT_EXPANSION_ID);
    expect(entitlementsService.unlockedIds.value).toEqual([DEFAULT_EXPANSION_ID]);
  });

  it('unlock concede via provider, muta o sinal e persiste', () => {
    const storage = memoryEntitlementsStorage();
    entitlementsService.init(storage);
    expect(entitlementsService.unlock('volcano')).toBe('ok');
    expect(entitlementsService.unlockedIds.value).toContain('volcano');
    expect(storage.load().unlocked).toContain('volcano');
  });

  it('unlock com provider que declina não muta o estado', () => {
    entitlementsService.init(memoryEntitlementsStorage(), decliningProvider);
    expect(entitlementsService.unlock('volcano')).toBe('unknown');
    expect(entitlementsService.unlockedIds.value).not.toContain('volcano');
  });

  it('select de expansão desbloqueada muda a ativa e persiste', () => {
    const storage = memoryEntitlementsStorage();
    entitlementsService.init(storage);
    entitlementsService.unlock('volcano');
    entitlementsService.select('volcano');
    expect(entitlementsService.activeExpansion.value.id).toBe('volcano');
    expect(storage.load().activeId).toBe('volcano');
  });

  it('select de expansão não desbloqueada é no-op', () => {
    entitlementsService.init(memoryEntitlementsStorage());
    entitlementsService.select('volcano');
    expect(entitlementsService.activeExpansion.value.id).toBe(DEFAULT_EXPANSION_ID);
  });
});
