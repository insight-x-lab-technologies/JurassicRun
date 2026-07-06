import { describe, it, expect, vi } from 'vitest';
import { openDonation, DONATE_URL } from '@app/home/donate';

describe('openDonation', () => {
  it('abre a URL de doação via openUrl injetado', () => {
    const openUrl = vi.fn();
    openDonation({ openUrl });
    expect(openUrl).toHaveBeenCalledWith(DONATE_URL);
  });

  it('engole erro do openUrl (best-effort, não propaga)', () => {
    const openUrl = vi.fn(() => {
      throw new Error('bloqueado');
    });
    expect(() => openDonation({ openUrl })).not.toThrow();
  });

  it('no-op quando não há openUrl', () => {
    expect(() => openDonation({})).not.toThrow();
  });
});
