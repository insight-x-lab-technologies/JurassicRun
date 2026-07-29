import { describe, it, expect } from 'vitest';
import { createWorld, step } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';

// worldHeight amplo p/ o dino sobreviver o suficiente e o clima sair de 'clear'.
//
// Tuning medido (nota p/ o 3º teste, "clima ligado ≠ desligado"): para a seed
// 'endless:WX4' o clima já está 'storm' em distance≈1629 (o fork 'weather' é
// independente do fork 'obstacles', então o ponto de virada depende só da seed, não do
// catálogo de obstáculos). Com STEPS=410 e flap a cada 36 steps, ambos os mundos
// (com/sem clima) seguem VIVOS até lá — medido: y_on≈245.98 (sob 'storm':
// gravityScale=1.25, downdraft=+90) vs y_off≈385.33 ('clear' o tempo todo, pois
// `weather:false` não gera weatherGenerator) — divergência real de trajetória, não
// coincidência de congelamento.
// Recalibrado no 9.8 (seed/flapEvery/STEPS antigos: WEATHER1/32/600): o catálogo de
// obstáculos cresceu de 4 para 7 tipos (rng.pick muda) e o novo `obstacle.gate` pode
// ocupar quase todo o campo vertical fora da fresta — nesse worldHeight=600 (bem maior
// que o campo lógico fixo 320×180 do jogo real) isso tornou a trajetória antiga letal
// bem antes do clima virar tempestade. Reduzir STEPS minimiza a exposição a obstáculos
// mantendo o clima chegando a 'storm' antes da morte.
const SEEDED: WorldConfig = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200, seed: 'endless:WX4' };
const STEPS = 410;
const FLAP_EVERY = 36;

function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % FLAP_EVERY === 0 });
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

describe('determinismo do clima', () => {
  it('reprodutibilidade: mesma seed+timeline ⇒ estado idêntico (clima ativo)', () => {
    const t = makeTimeline(STEPS);
    const a = runBatched(SEEDED, t, 1);
    const b = runBatched(SEEDED, t, 1);
    expect(a.weatherGenerator).not.toBeNull();
    expect(a).toEqual(b);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico', () => {
    const t = makeTimeline(STEPS);
    const one = runBatched(SEEDED, t, 1);
    const two = runBatched(SEEDED, t, 2);
    const five = runBatched(SEEDED, t, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('clima ligado ≠ desligado ⇒ trajetória (posição do dino) difere', () => {
    const t = makeTimeline(STEPS);
    const on = runBatched(SEEDED, t, 1);
    const off = runBatched({ ...SEEDED, weather: false }, t, 1);

    // Guarda de cobertura: garante que a divergência abaixo é uma divergência de
    // TRAJETÓRIA (ambos vivos, sem clamp de teto/chão), não uma coincidência de
    // "os dois morreram e o estado congelou no mesmo y". Se isto falhar, o cenário
    // não está mais exercitando o clima antes de qualquer morte (ver nota de tuning
    // acima) e precisa de novo ajuste de STEPS/seed — não relaxar a asserção seguinte.
    expect(on.alive).toBe(true);
    expect(off.alive).toBe(true);
    expect(on.weather).toBe('storm');

    // scroll/distância idênticos (clima só toca o eixo vertical)...
    expect(off.distance).toBeCloseTo(on.distance, 6);
    // ...mas a posição vertical do dino diverge por causa da física do clima.
    const dyOn = on.pterodactyl.transform.position.y;
    const dyOff = off.pterodactyl.transform.position.y;
    expect(dyOn).not.toBe(dyOff);
  });
});
