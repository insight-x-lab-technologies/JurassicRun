import type { Screen } from '@app/router';
import type { MusicTrack } from './tracks';

/** Teto de mixagem: música mais baixa que SFX (placeholder, tuning Fase 8). */
export const MUSIC_CEILING = 0.35;
export const SFX_CEILING = 0.6;

export interface AudioInput {
  readonly route: Screen;
  readonly volume: number; // 0..100
  readonly menuMusic: boolean;
  readonly gameplayMusic: boolean;
  readonly unlocked: boolean;
}

export interface AudioTarget {
  readonly track: MusicTrack | null;
  readonly musicGain: number; // 0..1
  readonly sfxGain: number; // 0..1
}

/** 0..100 → 0..1 com curva perceptual (v²); clampa fora de faixa. */
export function volumeToGain(volume0to100: number): number {
  if (volume0to100 <= 0) return 0;
  if (volume0to100 >= 100) return 1;
  const v = volume0to100 / 100;
  return v * v;
}

export function resolveAudioTarget(input: AudioInput): AudioTarget {
  const base = volumeToGain(input.volume);
  const musicGain = base * MUSIC_CEILING;
  const sfxGain = base * SFX_CEILING;

  if (base === 0) return { track: null, musicGain: 0, sfxGain: 0 };

  let track: MusicTrack | null = null;
  if (input.unlocked) {
    if (input.route === 'play') {
      track = input.gameplayMusic ? 'gameplay' : null;
    } else {
      track = input.menuMusic ? 'menu' : null;
    }
  }

  return { track, musicGain, sfxGain };
}
