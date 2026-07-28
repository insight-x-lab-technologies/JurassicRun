import { describe, it, expect } from 'vitest';
import { SFX_CATALOG, beatsToSeconds } from '@services/audio/tracks';

describe('audio tracks', () => {
  it('beatsToSeconds converte por BPM', () => {
    expect(beatsToSeconds(1, 60)).toBe(1);
    expect(beatsToSeconds(2, 120)).toBe(1);
    expect(beatsToSeconds(0, 90)).toBe(0);
  });

  it('catálogo de SFX tem click bem-formado', () => {
    const c = SFX_CATALOG.click;
    expect(c.freq).toBeGreaterThan(0);
    expect(c.durationSec).toBeGreaterThan(0);
    expect(c.attackSec).toBeGreaterThanOrEqual(0);
    expect(c.releaseSec).toBeGreaterThan(0);
  });
});
