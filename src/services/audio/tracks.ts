export type MusicTrack = 'menu' | 'gameplay';
export type SfxId = 'click';

/** Um passo da sequência; freq 0 = pausa. */
export interface NoteStep {
  readonly freq: number;
  readonly durBeats: number;
}

export interface TrackSpec {
  readonly bpm: number;
  readonly type: OscillatorType;
  readonly steps: readonly NoteStep[];
}

export interface SfxSpec {
  readonly type: OscillatorType;
  readonly freq: number;
  readonly durationSec: number;
  readonly attackSec: number;
  readonly releaseSec: number;
}

/** Sequências placeholder (tuning/composição real na Fase 8). */
export const MUSIC_TRACKS: Record<MusicTrack, TrackSpec> = Object.freeze({
  menu: Object.freeze({
    bpm: 84,
    type: 'sine',
    steps: Object.freeze([
      { freq: 220.0, durBeats: 1 },
      { freq: 261.63, durBeats: 1 },
      { freq: 329.63, durBeats: 1 },
      { freq: 261.63, durBeats: 1 },
      { freq: 293.66, durBeats: 1 },
      { freq: 220.0, durBeats: 1 },
      { freq: 0, durBeats: 2 },
    ]),
  }),
  gameplay: Object.freeze({
    bpm: 140,
    type: 'triangle',
    steps: Object.freeze([
      { freq: 329.63, durBeats: 0.5 },
      { freq: 392.0, durBeats: 0.5 },
      { freq: 440.0, durBeats: 0.5 },
      { freq: 392.0, durBeats: 0.5 },
      { freq: 329.63, durBeats: 0.5 },
      { freq: 293.66, durBeats: 0.5 },
      { freq: 329.63, durBeats: 1 },
      { freq: 0, durBeats: 0.5 },
    ]),
  }),
});

export const SFX_CATALOG: Record<SfxId, SfxSpec> = Object.freeze({
  click: Object.freeze({
    type: 'square',
    freq: 660,
    durationSec: 0.08,
    attackSec: 0.005,
    releaseSec: 0.07,
  }),
});

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}
