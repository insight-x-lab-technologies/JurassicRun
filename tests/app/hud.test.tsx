// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from 'preact';
import { Hud } from '../../src/app/game/Hud';
import { PauseOverlay } from '../../src/app/game/PauseOverlay';
import { EffectBadges } from '../../src/app/game/EffectBadges';
import type { HudLive } from '../../src/app/game/startGame';

describe('Hud DOM', () => {
  it('renderiza os campos do HUD', () => {
    const host = document.createElement('div');
    render(
      <Hud
        hud={{
          distance: 123, food: 4, level: 2, speed: 130, weather: 'clear', seed: 'endless:X',
          effects: [], extraLives: 0, trait: 'none',
        }}
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

const BASE: HudLive = {
  distance: 0, food: 0, level: 1, speed: 120, weather: 'clear', seed: 's',
  effects: [], extraLives: 0, trait: 'none',
};

describe('EffectBadges', () => {
  it('não renderiza nada sem efeito, sem vida extra e sem traço', () => {
    const host = document.createElement('div');
    render(<EffectBadges hud={BASE} />, host);
    expect(host.querySelectorAll('.effect-badge').length).toBe(0);
  });

  it('renderiza um chip por efeito ativo com a barra proporcional', () => {
    const host = document.createElement('div');
    render(
      <EffectBadges
        hud={{
          ...BASE,
          effects: [
            { kind: 'shield', seconds: 5, fraction: 1 },
            { kind: 'magnet', seconds: 3, fraction: 0.5 },
          ],
        }}
      />,
      host,
    );
    const chips = host.querySelectorAll('.effect-badge');
    expect(chips.length).toBe(2);
    const bar = chips[1]!.querySelector('.effect-badge__bar-fill') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('mostra as vidas extras só quando há carga', () => {
    const host = document.createElement('div');
    render(<EffectBadges hud={{ ...BASE, extraLives: 2 }} />, host);
    expect(host.querySelector('.effect-badge--lives')).not.toBeNull();
    render(<EffectBadges hud={{ ...BASE, extraLives: 0 }} />, host);
    expect(host.querySelector('.effect-badge--lives')).toBeNull();
  });

  it('mostra o traço da partida e some quando é none', () => {
    const host = document.createElement('div');
    render(<EffectBadges hud={{ ...BASE, trait: 'doubleFood' }} />, host);
    expect(host.querySelector('.effect-badge--trait')).not.toBeNull();
    render(<EffectBadges hud={{ ...BASE, trait: 'none' }} />, host);
    expect(host.querySelector('.effect-badge--trait')).toBeNull();
  });
});
