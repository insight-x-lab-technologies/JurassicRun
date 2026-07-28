import { describe, it, expect } from 'vitest';
import {
  volumeToGain,
  resolveAudioTarget,
  musicThemeFor,
  MUSIC_CEILING,
  SFX_CEILING,
} from '@services/audio/policy';
import type { AudioInput } from '@services/audio/policy';

const base: AudioInput = {
  route: 'home',
  volume: 100,
  menuMusic: true,
  gameplayMusic: true,
  buttonSfx: true,
  unlocked: true,
  expansionId: 'classic',
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
    expect(t).toEqual({ track: null, musicGain: 0, sfxGain: 0, uiSfxGain: 0, theme: 'classic' });
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

  it('buttonSfx off zera só o SFX de UI', () => {
    const t = resolveAudioTarget({ ...base, volume: 100, buttonSfx: false });
    expect(t.uiSfxGain).toBe(0);
    expect(t.sfxGain).toBeGreaterThan(0); // gameplay segue soando
  });

  it('buttonSfx on iguala o ganho de UI ao de gameplay', () => {
    const t = resolveAudioTarget({ ...base, volume: 100, buttonSfx: true });
    expect(t.uiSfxGain).toBe(t.sfxGain);
  });

  it('volume 0 zera os dois ganhos', () => {
    const t = resolveAudioTarget({ ...base, volume: 0, buttonSfx: true });
    expect(t.sfxGain).toBe(0);
    expect(t.uiSfxGain).toBe(0);
  });
});

describe('musicThemeFor', () => {
  it('mapeia as expansões conhecidas', () => {
    expect(musicThemeFor('classic')).toBe('classic');
    expect(musicThemeFor('volcano')).toBe('volcano');
    expect(musicThemeFor('glacier')).toBe('glacier');
  });

  it('cai em classic para id desconhecido', () => {
    expect(musicThemeFor('nao-existe')).toBe('classic');
    expect(musicThemeFor('')).toBe('classic');
  });
});

describe('resolveAudioTarget — tema', () => {
  it('propaga o tema da expansão ativa', () => {
    expect(resolveAudioTarget({ ...base, expansionId: 'volcano' }).theme).toBe('volcano');
  });

  it('mantém o tema mesmo em silêncio (o consumidor não precisa de fallback)', () => {
    expect(resolveAudioTarget({ ...base, volume: 0, expansionId: 'glacier' }).theme).toBe('glacier');
  });
});
