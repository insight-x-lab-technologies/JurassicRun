import { describe, it, expect } from 'vitest';
import { beatsToSeconds } from '@services/audio/tracks';

describe('audio tracks', () => {
  it('beatsToSeconds converte por BPM', () => {
    expect(beatsToSeconds(1, 60)).toBe(1);
    expect(beatsToSeconds(2, 120)).toBe(1);
    expect(beatsToSeconds(0, 90)).toBe(0);
  });
});
