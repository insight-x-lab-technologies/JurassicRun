import { describe, it, expect } from 'vitest';
import { honorSystemProvider } from '@services/entitlements/provider';

describe('honorSystemProvider', () => {
  it('concede o desbloqueio de qualquer id (honor-system)', () => {
    expect(honorSystemProvider.requestUnlock('volcano')).toBe('granted');
    expect(honorSystemProvider.requestUnlock('qualquer')).toBe('granted');
  });
});
