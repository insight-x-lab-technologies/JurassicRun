import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';
import { FOOD_SCORE_VALUE, NEAR_MISS_SCORE_VALUE, DISTANCE_SCORE_WEIGHT } from '@core/economy';

// Config escolhida empiricamente para que food > 0 E nearMisses > 0 dentro da corrida:
// worldHeight=180 (padrão) mantém o corredor de voo na faixa das entidades geradas pelo
// SpawnGenerator; seed 'endless:GAME1' com flapEvery=25 produz a trajetória que intercepta
// coletáveis e passa perto de obstáculos. Valores medidos: food=2, nearMisses=1,
// score≈690.14, distance≈665.14 (dino morre antes de 2000 steps; estado congela).
// flapSpeed fixado explicitamente em 240 (valor do FLAP_SPEED anterior ao tuning de gameplay)
// porque este cenário é uma trajetória empiricamente calibrada, não um teste do valor de
// FLAP_SPEED em si — desacopla o guard da constante de produção para não exigir recalibração
// a cada ajuste de tuning de flap.
const SEEDED: WorldConfig = { worldHeight: 180, startY: 90, seed: 'endless:GAME1', flapSpeed: 240 };
const STEPS = 2000;

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  // Flap a cada 25 steps (borda de subida): mantém o pterodáctilo em voo nivelado sem
  // acumular drift para o teto, atravessando o corredor onde os coletáveis/obstáculos são gerados.
  for (let i = 0; i < n; i++) out.push({ flap: i % 25 === 0 });
  return out;
}

function runBatched(config: WorldConfig, timeline: InputFrame[], batch: number): WorldState {
  const w = createWorld(config);
  let i = 0;
  while (i < timeline.length) {
    for (let b = 0; b < batch && i < timeline.length; b++, i++) step(w, timeline[i]!);
  }
  return w;
}

describe('determinismo da economia/score', () => {
  it('reprodutibilidade: mesma seed+timeline ⇒ score/food/nearMisses idênticos e não-triviais', () => {
    const t = makeTimeline(STEPS);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);

    // Guarda de cobertura: confirma que os três componentes do score foram exercitados.
    // Se a coleta ou o near-miss deixarem de funcionar, estes guards falham primeiro.
    expect(a.food).toBeGreaterThan(0);
    expect(a.nearMisses).toBeGreaterThan(0);

    // Reprodutibilidade (valores não-triviais: food e nearMisses > 0, score ≠ distance).
    expect(a.score).toBe(b.score);
    expect(a.food).toBe(b.food);
    expect(a.nearMisses).toBe(b.nearMisses);
    expect(a.distance).toBe(b.distance);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico', () => {
    const t = makeTimeline(STEPS);
    const one = runBatched(SEEDED, t, 1);
    const two = runBatched(SEEDED, t, 2);
    const five = runBatched(SEEDED, t, 5);
    expect(two.score).toBe(one.score);
    expect(five.score).toBe(one.score);
    // Estado completo idêntico (score/food/nearMisses/distance e spawners).
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('score agrega os três componentes: distância + comida + near-miss', () => {
    const t = makeTimeline(STEPS);
    const a = runBatched(SEEDED, t, 1);

    // Guarda primária: caminhos de comida e near-miss foram de fato percorridos.
    expect(a.food).toBeGreaterThan(0);
    expect(a.nearMisses).toBeGreaterThan(0);

    // Fórmula de acúmulo incremental (scoreMultiplier=1 o tempo todo):
    // score = distance × DISTANCE_SCORE_WEIGHT + food × FOOD_SCORE_VALUE + nearMisses × NEAR_MISS_SCORE_VALUE
    // Comparado com toBeCloseTo para absorver diferença de ordem de soma em floating point.
    const expected = a.distance * DISTANCE_SCORE_WEIGHT + a.food * FOOD_SCORE_VALUE + a.nearMisses * NEAR_MISS_SCORE_VALUE;
    expect(a.score).toBeCloseTo(expected, 6);

    // Confirma que score É MAIOR que distância (comida+near-miss contribuem positivamente).
    expect(a.score).toBeGreaterThan(a.distance);
  });
});
