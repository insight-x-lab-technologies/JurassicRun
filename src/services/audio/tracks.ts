export type MusicTrack = 'menu' | 'gameplay';
export type SfxId = 'click';

export interface SfxSpec {
  readonly type: OscillatorType;
  readonly freq: number;
  readonly durationSec: number;
  readonly attackSec: number;
  readonly releaseSec: number;
}

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
