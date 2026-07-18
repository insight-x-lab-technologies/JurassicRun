import { describe, expect, it, beforeEach } from 'vitest';
import { entitlementsService } from '@services/entitlements';
import { memoryEntitlementsStorage } from '@services/entitlements/storage';

describe('entitlementsService.grantAndSelect', () => {
  beforeEach(() => entitlementsService.init(memoryEntitlementsStorage()));
  it('desbloqueia e ativa sem passar pelo provider', () => {
    entitlementsService.grantAndSelect('volcano');
    expect(entitlementsService.unlockedIds.value).toContain('volcano');
    expect(entitlementsService.activeExpansion.value.id).toBe('volcano');
  });
});
