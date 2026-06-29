import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import { FOOD_SCORE_VALUE } from '@core/economy';

describe('integração da economia no step', () => {
  it('mundo recém-criado: score 0 e scoreMultiplier 1', () => {
    const w = createWorld({ seed: 'endless:E' });
    expect(w.score).toBe(0);
    expect(w.scoreMultiplier).toBe(1);
  });

  it('voar sem coletar/morrer: score cresce e é igual à distância acumulada (peso 1, mult 1)', () => {
    // Sem seed ⇒ sem obstáculos/coletáveis: só a distância pontua. DISTANCE_SCORE_WEIGHT=1.
    const w = createWorld({ worldHeight: 100000, startY: 50000 });
    for (let i = 0; i < 500; i++) step(w, { flap: i % 2 === 0 });
    expect(w.score).toBeGreaterThan(0);
    expect(w.score).toBeCloseTo(w.distance, 9); // peso 1, multiplicador 1
  });

  it('coletar comida adiciona FOOD_SCORE_VALUE no step da coleta', () => {
    // Mundo estático (gravity=0, flapSpeed=0) com moeda na frente do dino — abordagem
    // determinística (sem dependência de RNG + worldHeight grande). Mesma intenção do spec:
    // verificar que scoreGained >= foodGained * FOOD_SCORE_VALUE no step da coleta.
    const w = createWorld({ worldHeight: 200, startY: 100, gravity: 0, flapSpeed: 0, scrollSpeed: 60 });
    w.collectibles.push({
      id: 0, type: 'collectible', tags: ['bird.coin'],
      transform: { position: { x: 4, y: 100 } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: { kind: 'circle', radius: 8 },
    });
    let prevFood = w.food;
    let prevScore = w.score;
    let observed = false;
    for (let i = 0; i < 10 && !observed; i++) {
      step(w, { flap: false });
      if (w.food > prevFood) {
        const foodGained = w.food - prevFood;
        const scoreGained = w.score - prevScore;
        // score do step = distância(dx)*1 + comida*FOOD_SCORE_VALUE. A parte de comida:
        expect(scoreGained).toBeGreaterThanOrEqual(foodGained * FOOD_SCORE_VALUE);
        observed = true;
      }
      prevFood = w.food;
      prevScore = w.score;
    }
    expect(observed).toBe(true);
  });

  it('multiplicador temporário banca correto: pontos ganhos no 2x permanecem ao voltar a 1', () => {
    const w = createWorld({ worldHeight: 100000, startY: 50000 });
    // Fase 1: multiplicador 1 por alguns steps.
    for (let i = 0; i < 100; i++) step(w, { flap: i % 2 === 0 });
    const scoreAfterPhase1 = w.score;
    // Fase 2: multiplicador 2 por alguns steps (simula power-up ativo).
    w.scoreMultiplier = 2;
    for (let i = 0; i < 100; i++) step(w, { flap: i % 2 === 0 });
    const scoreAfterPhase2 = w.score;
    const gainedDuring2x = scoreAfterPhase2 - scoreAfterPhase1;
    // Fase 3: multiplicador volta a 1; o score NÃO regride (pontos do 2x ficam bancados).
    w.scoreMultiplier = 1;
    for (let i = 0; i < 100; i++) step(w, { flap: i % 2 === 0 });
    expect(w.score).toBeGreaterThan(scoreAfterPhase2);
    // O ganho no 2x foi ~2x o ganho equivalente a 1x (distância por step é da mesma ordem).
    expect(gainedDuring2x).toBeGreaterThan(scoreAfterPhase1 * 1.5);
  });

  it('congelamento na morte: score não muda após morrer', () => {
    // Mundo baixo + gravidade: cai e morre no chão. Após a morte, step é no-op.
    const w = createWorld({ worldHeight: 50, startY: 25 });
    while (w.alive && w.tick < 100000) step(w, { flap: false });
    expect(w.alive).toBe(false);
    const scoreAtDeath = w.score;
    for (let i = 0; i < 50; i++) step(w, { flap: true });
    expect(w.score).toBe(scoreAtDeath);
  });
});
