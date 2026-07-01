import { describe, it, expect } from 'vitest';
import { HudTicker, formatHudValues, HUD_REFRESH_INTERVAL } from '@render/hud';

describe('HudTicker', () => {
  it('retorna null antes de a janela fechar', () => {
    const t = new HudTicker(0.2);
    expect(t.tick(0.05)).toBeNull();
    expect(t.tick(0.05)).toBeNull(); // 0.10 < 0.20
  });

  it('ao cruzar a janela retorna fps = frames / tempo decorrido', () => {
    const t = new HudTicker(0.2);
    expect(t.tick(0.1)).toBeNull(); // 0.10
    const fps = t.tick(0.1); // 0.20 ⇒ fecha: 2 frames / 0.2s = 10
    expect(fps).not.toBeNull();
    expect(fps as number).toBeCloseTo(10, 5);
  });

  it('reseta a janela após fechar (frames e tempo)', () => {
    const t = new HudTicker(0.2);
    t.tick(0.1);
    t.tick(0.1); // fecha
    expect(t.tick(0.1)).toBeNull(); // nova janela recomeça do zero
  });

  it('um frame gigante (aba em background) fecha a janela sem estourar', () => {
    const t = new HudTicker(0.2);
    const fps = t.tick(5); // 1 frame / 5s = 0.2
    expect(fps as number).toBeCloseTo(0.2, 5);
  });

  it('usa HUD_REFRESH_INTERVAL como default', () => {
    const t = new HudTicker();
    expect(t.tick(HUD_REFRESH_INTERVAL)).not.toBeNull();
  });
});

describe('formatHudValues', () => {
  it('faz floor de distância/food/level e round de fps/speed; seed passthrough', () => {
    const view = formatHudValues({
      distance: 123.9,
      food: 4,
      fps: 59.6,
      level: 3,
      speed: 62.4,
      seed: 'endless:DEMO',
    });
    expect(view).toEqual({
      distance: '123',
      food: '4',
      fps: '60',
      level: '3',
      speed: '62',
      seed: 'endless:DEMO',
    });
  });
});
