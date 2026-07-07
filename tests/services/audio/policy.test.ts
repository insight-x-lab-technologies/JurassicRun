import { describe, it, expect } from 'vitest';
import {
  volumeToGain,
  resolveAudioTarget,
  MUSIC_CEILING,
  SFX_CEILING,
} from '@services/audio/policy';
import type { AudioInput } from '@services/audio/policy';

const base: AudioInput = {
  route: 'home',
  volume: 100,
  menuMusic: true,
  gameplayMusic: true,
  unlocked: true,
};

describe('volumeToGain', () => {
  it('mapeia extremos e é monotônico', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(-5)).toBe(0);
    expect(volumeToGain(999)).toBe(1);
    expect(volumeToGain(50)).toBeGreaterThan(0);
    expect(volumeToGain(50)).toBeLessThan(volumeToGain(80));
  });
});

describe('resolveAudioTarget', () => {
  it('sem unlock ⇒ nenhuma música (mas sfxGain calculado)', () => {
    const t = resolveAudioTarget({ ...base, unlocked: false });
    expect(t.track).toBeNull();
    expect(t.sfxGain).toBeGreaterThan(0);
  });

  it('volume 0 ⇒ silêncio total', () => {
    const t = resolveAudioTarget({ ...base, volume: 0 });
    expect(t).toEqual({ track: null, musicGain: 0, sfxGain: 0 });
  });

  it('rota play + gameplayMusic ⇒ faixa gameplay', () => {
    const t = resolveAudioTarget({ ...base, route: 'play' });
    expect(t.track).toBe('gameplay');
    expect(t.musicGain).toBeCloseTo(volumeToGain(100) * MUSIC_CEILING);
    expect(t.sfxGain).toBeCloseTo(volumeToGain(100) * SFX_CEILING);
  });

  it('rota play com gameplayMusic off ⇒ sem música', () => {
    const t = resolveAudioTarget({ ...base, route: 'play', gameplayMusic: false });
    expect(t.track).toBeNull();
    expect(t.sfxGain).toBeGreaterThan(0);
  });

  it('rota de menu ⇒ faixa menu; onboarding (home) também', () => {
    expect(resolveAudioTarget({ ...base, route: 'home' }).track).toBe('menu');
    expect(resolveAudioTarget({ ...base, route: 'nest' }).track).toBe('menu');
  });

  it('menuMusic off em rota de menu ⇒ sem música', () => {
    const t = resolveAudioTarget({ ...base, route: 'shop', menuMusic: false });
    expect(t.track).toBeNull();
  });
});
