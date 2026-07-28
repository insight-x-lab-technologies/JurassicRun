import { describe, it, expect } from 'vitest';
import { musicFileUrl } from '@services/audio/musicSource';

describe('musicFileUrl', () => {
  it('monta a URL sob a base da app', () => {
    expect(musicFileUrl('classic', 'menu', '/')).toBe('/audio/classic/menu.mp3');
    expect(musicFileUrl('volcano', 'gameplay', '/JurassicRun/'))
      .toBe('/JurassicRun/audio/volcano/gameplay.mp3');
  });

  it('normaliza base sem barra final', () => {
    expect(musicFileUrl('glacier', 'menu', '/sub')).toBe('/sub/audio/glacier/menu.mp3');
  });
});
