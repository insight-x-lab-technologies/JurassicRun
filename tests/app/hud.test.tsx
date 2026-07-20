// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { Hud } from '../../src/app/game/Hud';
import { PauseOverlay } from '../../src/app/game/PauseOverlay';

describe('Hud DOM', () => {
  it('renderiza os campos do HUD', () => {
    const host = document.createElement('div');
    render(
      <Hud
        hud={{ distance: 123, food: 4, level: 2, speed: 130, weather: 'clear', seed: 'endless:X' }}
        fps={60}
      />,
      host,
    );
    expect(host.querySelector('.hud')).not.toBeNull();
    expect(host.querySelectorAll('.hud > span').length).toBe(7); // 7 campos do HUD
  });
});

describe('PauseOverlay', () => {
  it('renderiza título e dica', () => {
    const host = document.createElement('div');
    render(<PauseOverlay />, host);
    expect(host.querySelector('.pause-overlay__title')).not.toBeNull();
    expect(host.querySelector('.pause-overlay__hint')).not.toBeNull();
  });
});
