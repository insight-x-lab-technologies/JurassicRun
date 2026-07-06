import { describe, it, expect } from 'vitest';
import {
  initialEntitlementsState,
  isUnlocked,
  unlock,
  setActive,
} from '@services/entitlements/store';
import { DEFAULT_EXPANSION_ID } from '@services/entitlements/catalog';

describe('entitlements store', () => {
  it('inicia com a expansão default desbloqueada e ativa', () => {
    const s = initialEntitlementsState();
    expect(s.unlocked).toEqual([DEFAULT_EXPANSION_ID]);
    expect(s.activeId).toBe(DEFAULT_EXPANSION_ID);
    expect(isUnlocked(s, DEFAULT_EXPANSION_ID)).toBe(true);
  });

  it('unlock adiciona a expansão e é imutável', () => {
    const s = initialEntitlementsState();
    const { state, result } = unlock(s, 'volcano');
    expect(result).toBe('ok');
    expect(state.unlocked).toContain('volcano');
    expect(s.unlocked).not.toContain('volcano'); // original intacto
    expect(state.activeId).toBe(DEFAULT_EXPANSION_ID); // unlock NÃO ativa
  });

  it('unlock é idempotente', () => {
    const s = unlock(initialEntitlementsState(), 'volcano').state;
    const { state, result } = unlock(s, 'volcano');
    expect(result).toBe('alreadyUnlocked');
    expect(state).toBe(s);
  });

  it('unlock de id fora do catálogo é unknown', () => {
    const s = initialEntitlementsState();
    const { state, result } = unlock(s, 'nope');
    expect(result).toBe('unknown');
    expect(state).toBe(s);
  });

  it('setActive só ativa expansão desbloqueada', () => {
    const s = initialEntitlementsState();
    expect(setActive(s, 'volcano')).toBe(s); // não desbloqueada ⇒ no-op
    const unlocked = unlock(s, 'volcano').state;
    const active = setActive(unlocked, 'volcano');
    expect(active.activeId).toBe('volcano');
    expect(active.unlocked).toEqual(unlocked.unlocked);
  });
});
