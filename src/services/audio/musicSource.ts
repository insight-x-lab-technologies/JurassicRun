// Seam de trilha de ARQUIVO (Regra 2 aplicada a áudio): se existir o MP3 no caminho abaixo, ele
// toca no lugar da música procedural. Sem arquivo ⇒ procedural, sem custo e sem rede.
// Briefing de geração: docs/audio/specs/SUNO-BRIEF.md
import type { MusicTheme } from './music';
import type { MusicTrack } from './tracks';

export function musicFileUrl(theme: MusicTheme, track: MusicTrack, base: string): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}audio/${theme}/${track}.mp3`;
}
