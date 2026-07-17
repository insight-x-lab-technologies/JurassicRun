import { describe, expect, it } from 'vitest';
import { shouldSuggestRotate } from './orientation';

describe('shouldSuggestRotate', () => {
  it('sugere girar só em retrato com ponteiro grosso (toque)', () => {
    expect(shouldSuggestRotate({ portrait: true, coarsePointer: true })).toBe(true);
  });

  it('não sugere em paisagem', () => {
    expect(shouldSuggestRotate({ portrait: false, coarsePointer: true })).toBe(false);
  });

  it('não sugere em retrato com ponteiro fino (desktop/janela estreita)', () => {
    expect(shouldSuggestRotate({ portrait: true, coarsePointer: false })).toBe(false);
  });

  it('não sugere em paisagem com ponteiro fino', () => {
    expect(shouldSuggestRotate({ portrait: false, coarsePointer: false })).toBe(false);
  });
});
