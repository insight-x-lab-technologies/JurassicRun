import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import { DISTANCE_PER_LEVEL } from '@core/difficulty';

describe('integração da dificuldade no step', () => {
  it('mundo recém-criado: level 1 e scrollSpeed = baseScrollSpeed (reset por partida)', () => {
    const w = createWorld({ seed: 'endless:R' });
    expect(w.level).toBe(1);
    expect(w.scrollSpeed).toBe(w.baseScrollSpeed);
  });

  it('com dificuldade (default): scrollSpeed cresce ao longo de muitos steps', () => {
    // Sem seed (sem obstáculos/colisão); mundo alto: o dino sobe e encosta no teto (clamp,
    // sem morte) e segue avançando em x ⇒ distância cresce ⇒ velocidade efetiva cresce.
    const w = createWorld({ worldHeight: 1000, startY: 500 });
    const s0 = w.scrollSpeed;
    for (let i = 0; i < 1000; i++) step(w, { flap: i % 8 === 0 });
    expect(w.distance).toBeGreaterThan(0);
    expect(w.scrollSpeed).toBeGreaterThan(s0);
  });

  it('com difficulty:false: scrollSpeed constante e level sempre 1', () => {
    const w = createWorld({ difficulty: false, worldHeight: 1000, startY: 500 });
    const s0 = w.scrollSpeed;
    for (let i = 0; i < 1000; i++) step(w, { flap: i % 8 === 0 });
    expect(w.scrollSpeed).toBe(s0);
    expect(w.level).toBe(1);
  });

  it('level sobe ao cruzar DISTANCE_PER_LEVEL', () => {
    // Mundo enorme p/ não morrer; voa ~estável e acumula distância.
    const w = createWorld({ worldHeight: 100000, startY: 50000 });
    while (w.distance < DISTANCE_PER_LEVEL && w.tick < 100000) step(w, { flap: w.tick % 2 === 0 });
    expect(w.level).toBeGreaterThanOrEqual(2);
  });
});
