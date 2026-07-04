import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig } from '@core/sim';

const NO_FLAP: InputFrame = { flap: false };
const BASE: WorldConfig = { worldHeight: 600, startY: 100, gravity: 1200, flapSpeed: 350, scrollSpeed: 200 };

function fallSteps(w: ReturnType<typeof createWorld>, n: number): void {
  for (let i = 0; i < n; i++) step(w, NO_FLAP);
}

describe('clima — integração no mundo/step', () => {
  it('sem seed: sem gerador, clima clear, física baseline (dino cai sob gravidade)', () => {
    const w = createWorld({ ...BASE });
    expect(w.weather).toBe('clear');
    expect(w.weatherGenerator).toBeNull();
    fallSteps(w, 30);
    expect(w.pterodactyl.transform.position.y).toBeGreaterThan(BASE.startY!);
  });

  it('com seed: constrói o gerador de clima', () => {
    const w = createWorld({ ...BASE, seed: 'endless:WX' });
    expect(w.weatherGenerator).not.toBeNull();
  });

  it('weather:false desliga o gerador mesmo com seed', () => {
    const w = createWorld({ ...BASE, seed: 'endless:WX', weather: false });
    expect(w.weatherGenerator).toBeNull();
    expect(w.weather).toBe('clear');
  });

  it('rain (gravityScale>1) faz cair mais rápido que clear', () => {
    const clear = createWorld({ ...BASE }); // gerador null ⇒ step não sobrescreve weather
    const rainy = createWorld({ ...BASE });
    rainy.weather = 'rain';
    fallSteps(clear, 20);
    fallSteps(rainy, 20);
    expect(rainy.pterodactyl.transform.position.y).toBeGreaterThan(clear.pterodactyl.transform.position.y);
  });

  it('wind (windY<0, updraft) segura a queda vs clear', () => {
    const clear = createWorld({ ...BASE });
    const windy = createWorld({ ...BASE });
    windy.weather = 'wind';
    fallSteps(clear, 20);
    fallSteps(windy, 20);
    expect(windy.pterodactyl.transform.position.y).toBeLessThan(clear.pterodactyl.transform.position.y);
  });
});
