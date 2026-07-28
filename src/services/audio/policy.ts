import type { Screen } from '@app/router';
import type { MusicTrack } from './tracks';
import type { MusicTheme } from './music';

/** Teto de mixagem: música mais baixa que SFX (placeholder, tuning Fase 8). */
export const MUSIC_CEILING = 0.35;
export const SFX_CEILING = 0.6;

const THEMES: ReadonlySet<string> = new Set<string>(['classic', 'volcano', 'glacier']);

/** Id da expansão ativa (seam 4.6/8.3) → tema musical. Desconhecido ⇒ `classic`. */
export function musicThemeFor(expansionId: string): MusicTheme {
  return THEMES.has(expansionId) ? (expansionId as MusicTheme) : 'classic';
}

export interface AudioInput {
  readonly route: Screen;
  readonly volume: number; // 0..100
  readonly menuMusic: boolean;
  readonly gameplayMusic: boolean;
  readonly buttonSfx: boolean;
  readonly unlocked: boolean;
  readonly expansionId: string;
}

export interface AudioTarget {
  readonly track: MusicTrack | null;
  readonly musicGain: number; // 0..1
  readonly sfxGain: number; // 0..1
  readonly uiSfxGain: number; // 0..1
  readonly theme: MusicTheme;
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
  const uiSfxGain = input.buttonSfx ? sfxGain : 0;
  const theme = musicThemeFor(input.expansionId);

  if (base === 0) return { track: null, musicGain: 0, sfxGain: 0, uiSfxGain: 0, theme };

  let track: MusicTrack | null = null;
  if (input.unlocked) {
    if (input.route === 'play') {
      track = input.gameplayMusic ? 'gameplay' : null;
    } else {
      track = input.menuMusic ? 'menu' : null;
    }
  }

  return { track, musicGain, sfxGain, uiSfxGain, theme };
}
