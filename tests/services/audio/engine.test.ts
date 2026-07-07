import { describe, it, expect } from 'vitest';
import { nullAudioEngine } from '@services/audio/engine';

describe('nullAudioEngine (spy)', () => {
  it('registra playMusic/setMusicGain/stopMusic e running', () => {
    const e = nullAudioEngine();
    expect(e.running).toBeNull();

    e.playMusic('menu', 0.3);
    expect(e.running).toBe('menu');
    expect(e.musicStarts).toEqual(['menu']);
    expect(e.lastMusicGain).toBeCloseTo(0.3);

    e.setMusicGain(0.1);
    expect(e.lastMusicGain).toBeCloseTo(0.1);
    expect(e.running).toBe('menu'); // gain ao vivo não reinicia

    e.stopMusic();
    expect(e.running).toBeNull();
    expect(e.stops).toBe(1);
  });

  it('registra sfx e resume', async () => {
    const e = nullAudioEngine();
    e.playSfx('click', 0.5);
    expect(e.sfxPlayed).toEqual(['click']);
    await e.resume();
    expect(e.resumed).toBe(true);
  });
});
