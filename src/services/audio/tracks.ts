export type MusicTrack = 'menu' | 'gameplay';

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}
