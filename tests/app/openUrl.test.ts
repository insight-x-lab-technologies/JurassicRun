import { describe, it, expect } from 'vitest';
import { openExternal } from '@app/openUrl';

describe('openExternal', () => {
  it('chama o abridor injetado com a URL', () => {
    const seen: string[] = [];
    openExternal('https://exemplo.test/x', { openUrl: (u) => seen.push(u) });
    expect(seen).toEqual(['https://exemplo.test/x']);
  });

  it('sem abridor disponível não faz nada e não lança', () => {
    expect(() => openExternal('https://exemplo.test/x', {})).not.toThrow();
  });

  it('abridor que lança (popup bloqueado) não derruba o chamador', () => {
    expect(() =>
      openExternal('https://exemplo.test/x', {
        openUrl: () => {
          throw new Error('popup blocked');
        },
      }),
    ).not.toThrow();
  });
});
