import { describe, it, expect } from 'vitest';
import { MUSIC_TRACKS, SFX_CATALOG, beatsToSeconds } from '@services/audio/tracks';

describe('audio tracks', () => {
  it('beatsToSeconds converte por BPM', () => {
    expect(beatsToSeconds(1, 60)).toBe(1);
    expect(beatsToSeconds(2, 120)).toBe(1);
    expect(beatsToSeconds(0, 90)).toBe(0);
  });

  it('as duas faixas existem e são bem-formadas', () => {
    for (const track of ['menu', 'gameplay'] as const) {
      const spec = MUSIC_TRACKS[track];
      expect(spec.bpm).toBeGreaterThan(0);
      expect(spec.steps.length).toBeGreaterThan(0);
      for (const s of spec.steps) {
        expect(s.freq).toBeGreaterThanOrEqual(0);
        expect(s.durBeats).toBeGreaterThan(0);
      }
    }
  });

  it('catálogo de SFX tem click bem-formado', () => {
    const c = SFX_CATALOG.click;
    expect(c.freq).toBeGreaterThan(0);
    expect(c.durationSec).toBeGreaterThan(0);
    expect(c.attackSec).toBeGreaterThanOrEqual(0);
    expect(c.releaseSec).toBeGreaterThan(0);
  });
});
