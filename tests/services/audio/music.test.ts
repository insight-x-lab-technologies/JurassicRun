import { describe, it, expect } from 'vitest';
import {
  midiToFreq,
  scaleDegreeToMidi,
  voicesForBar,
  MUSIC_SCORES,
  MAX_VOICES_PER_BAR,
  type Voice,
  type MusicTheme,
} from '@services/audio/music';
import type { MusicTrack } from '@services/audio/tracks';

const THEMES: MusicTheme[] = ['classic', 'volcano', 'glacier'];
const TRACKS: MusicTrack[] = ['menu', 'gameplay'];

describe('midiToFreq', () => {
  it('ancora em A4 = 440 Hz e dobra por oitava', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });
});

describe('scaleDegreeToMidi', () => {
  it('grau 0 = tônica; graus acima do modo sobem de oitava', () => {
    const score = MUSIC_SCORES.classic.menu;
    expect(scaleDegreeToMidi(score, 0, 0)).toBe(score.rootMidi);
    const n = score.scale.length;
    expect(scaleDegreeToMidi(score, n, 0)).toBe(score.rootMidi + 12);
    expect(scaleDegreeToMidi(score, 0, 1)).toBe(score.rootMidi + 12);
  });

  it('graus negativos descem sem quebrar', () => {
    const score = MUSIC_SCORES.classic.menu;
    expect(scaleDegreeToMidi(score, -1, 0)).toBeLessThan(score.rootMidi);
  });
});

describe('MUSIC_SCORES', () => {
  it('cobre os 3 temas × 2 contextos com dados válidos', () => {
    for (const theme of THEMES) {
      for (const track of TRACKS) {
        const s = MUSIC_SCORES[theme][track];
        expect(s.id).toBe(`${theme}.${track}`);
        expect(s.bpm).toBeGreaterThan(40);
        expect(s.bpm).toBeLessThan(200);
        expect(s.beatsPerBar).toBeGreaterThan(0);
        expect(s.bars).toBeGreaterThan(1);
        expect(s.scale.length).toBeGreaterThanOrEqual(5);
        expect(s.progression.length).toBe(s.bars);
        for (const layer of ['bass', 'drums', 'melody', 'pad'] as const) {
          const l = s.layers[layer];
          expect(l.gain).toBeGreaterThan(0);
          expect(l.gain).toBeLessThanOrEqual(1);
          expect(l.pattern.length).toBeGreaterThan(0);
          for (const beat of l.pattern) {
            expect(beat).toBeGreaterThanOrEqual(0);
            expect(beat).toBeLessThan(s.beatsPerBar);
          }
        }
      }
    }
  });

  it('gameplay é mais rápido que menu em todos os temas', () => {
    for (const theme of THEMES) {
      expect(MUSIC_SCORES[theme].gameplay.bpm).toBeGreaterThan(MUSIC_SCORES[theme].menu.bpm);
    }
  });

  it('os temas soam diferentes (tônica ou modo distintos no gameplay)', () => {
    const fingerprint = (t: MusicTheme): string =>
      `${MUSIC_SCORES[t].gameplay.rootMidi}:${MUSIC_SCORES[t].gameplay.scale.join(',')}`;
    const all = THEMES.map(fingerprint);
    expect(new Set(all).size).toBe(THEMES.length);
  });
});

describe('voicesForBar', () => {
  it('é determinístico: a mesma barra gera as mesmas vozes', () => {
    const score = MUSIC_SCORES.classic.gameplay;
    const a: Voice[] = [];
    const b: Voice[] = [];
    voicesForBar(score, 3, a);
    voicesForBar(score, 3, b);
    expect(b).toEqual(a);
  });

  it('barras diferentes variam a melodia', () => {
    const score = MUSIC_SCORES.classic.gameplay;
    const melodyOf = (bar: number): number[] => {
      const out: Voice[] = [];
      voicesForBar(score, bar, out);
      return out.filter((v) => v.layer === 'melody').map((v) => v.freq);
    };
    const bars = [0, 1, 2, 3, 4, 5, 6, 7].map(melodyOf);
    const distinct = new Set(bars.map((b) => b.join(',')));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('o loop fecha: a barra N e a barra N + bars são idênticas', () => {
    const score = MUSIC_SCORES.classic.gameplay;
    const a: Voice[] = [];
    const b: Voice[] = [];
    voicesForBar(score, 2, a);
    voicesForBar(score, 2 + score.bars, b);
    expect(b).toEqual(a);
  });

  it('reusa o array de saída (sem alocação por compasso)', () => {
    const score = MUSIC_SCORES.volcano.gameplay;
    const out: Voice[] = [];
    const returned = voicesForBar(score, 0, out);
    expect(returned).toBe(out);
    const firstObject = out[0];
    voicesForBar(score, 1, out);
    expect(out[0]).toBe(firstObject); // objetos de voz reciclados, não recriados
  });

  it('todas as vozes cabem no compasso e respeitam o teto', () => {
    for (const theme of THEMES) {
      for (const track of TRACKS) {
        const score = MUSIC_SCORES[theme][track];
        const out: Voice[] = [];
        for (let bar = 0; bar < score.bars; bar += 1) {
          voicesForBar(score, bar, out);
          expect(out.length).toBeLessThanOrEqual(MAX_VOICES_PER_BAR);
          for (const v of out) {
            expect(v.startBeat).toBeGreaterThanOrEqual(0);
            expect(v.startBeat).toBeLessThan(score.beatsPerBar);
            expect(v.durBeats).toBeGreaterThan(0);
            expect(v.gain).toBeGreaterThan(0);
            if (v.timbre === 'kick' || v.timbre === 'snare' || v.timbre === 'hat') continue;
            expect(v.freq).toBeGreaterThan(20);
            expect(v.freq).toBeLessThan(5000);
          }
        }
      }
    }
  });

  it('todas as 4 camadas aparecem ao longo do loop', () => {
    const score = MUSIC_SCORES.glacier.gameplay;
    const seen = new Set<string>();
    const out: Voice[] = [];
    for (let bar = 0; bar < score.bars; bar += 1) {
      voicesForBar(score, bar, out);
      for (const v of out) seen.add(v.layer);
    }
    expect(seen).toEqual(new Set(['bass', 'drums', 'melody', 'pad']));
  });
});
