import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step, FIXED_DT } from '@core/sim';
import type { InputFrame, WorldConfig, WorldState } from '@core/sim';
import { SpawnGenerator } from '@core/spawn';

// Config fixa (independente das constantes de tuning de gameplay) para pinos de regressão.
const FIXED_CONFIG: WorldConfig = {
  worldHeight: 200,
  startY: 100,
  gravity: 600,
  flapSpeed: 260,
  scrollSpeed: 130,
};

/** Timeline determinística: flap a cada 12 steps (segurado por 1 step). */
function makeTimeline(n: number): InputFrame[] {
  const out: InputFrame[] = [];
  for (let i = 0; i < n; i++) out.push({ flap: i % 12 === 0 });
  return out;
}

/** Roda a timeline com `batch` steps por "frame" (simula o acumulador do render). */
function runBatched(config: WorldConfig, timeline: InputFrame[], batch: number): WorldState {
  const w = createWorld(config);
  let i = 0;
  while (i < timeline.length) {
    for (let b = 0; b < batch && i < timeline.length; b++, i++) {
      step(w, timeline[i]!);
    }
  }
  return w;
}

describe('determinismo da simulação', () => {
  it('reprodutibilidade: mesma seed-config + mesma timeline ⇒ estado idêntico', () => {
    const timeline = makeTimeline(600);
    const a = runBatched(FIXED_CONFIG, timeline, 1);
    const b = runBatched(FIXED_CONFIG, timeline, 1);
    expect(a).toEqual(b);
  });

  it('independência de fps: 1, 2 e 5 steps por frame ⇒ estado idêntico', () => {
    const timeline = makeTimeline(600);
    const one = runBatched(FIXED_CONFIG, timeline, 1);
    const two = runBatched(FIXED_CONFIG, timeline, 2);
    const five = runBatched(FIXED_CONFIG, timeline, 5);
    expect(two).toEqual(one);
    expect(five).toEqual(one);
  });

  it('config fixa: avanço de distance e tick é estável e previsível antes da morte', () => {
    // Sem flap: cai até morrer; verifica relações exatas até o passo da morte.
    const w = createWorld({ ...FIXED_CONFIG, difficulty: false });
    let steps = 0;
    while (w.alive && steps < 10000) {
      step(w, { flap: false });
      steps++;
    }
    expect(w.alive).toBe(false);
    expect(w.tick).toBe(steps);
    expect(w.distance).toBeCloseTo(steps * FIXED_CONFIG.scrollSpeed! * FIXED_DT, 6);
  });

  it('cloneWorld isola snapshots: avançar o clone não altera o original', () => {
    const w = createWorld(FIXED_CONFIG);
    step(w, { flap: false });
    const snapshot = cloneWorld(w);
    for (let i = 0; i < 50; i++) step(w, { flap: i % 5 === 0 });
    // snapshot permanece no estado de tick=1
    expect(snapshot.tick).toBe(1);
  });
});

describe('determinismo de spawn integrado ao step', () => {
  const SEEDED: WorldConfig = { ...FIXED_CONFIG, seed: 'endless:RUN1' };

  it('sem seed ⇒ sem spawner e sem obstáculos', () => {
    const w = createWorld(FIXED_CONFIG);
    expect(w.spawner).toBeNull();
    for (let i = 0; i < 300; i++) step(w, { flap: i % 12 === 0 });
    expect(w.obstacles).toEqual([]);
  });

  it('com seed ⇒ obstáculos aparecem ao avançar', () => {
    const w = createWorld(SEEDED);
    expect(w.spawner).toBeInstanceOf(SpawnGenerator);
    for (let i = 0; i < 400; i++) step(w, { flap: i % 12 === 0 });
    expect(w.obstacles.length).toBeGreaterThan(0);
  });

  it('fps-independência: 1, 2 e 5 steps por frame ⇒ obstáculos idênticos', () => {
    const timeline = makeTimeline(900);
    const one = runBatched(SEEDED, timeline, 1);
    const two = runBatched(SEEDED, timeline, 2);
    const five = runBatched(SEEDED, timeline, 5);
    expect(two.obstacles).toEqual(one.obstacles);
    expect(five.obstacles).toEqual(one.obstacles);
  });

  it('cloneWorld isola o spawner: avançar o original não muda o clone', () => {
    // Gera obstáculos diretamente no spawner (sem step) para não depender do dino sobreviver
    // a colisões — comportamento correto após integrar a passada de colisão em 1.6.
    // O que testamos: cloneWorld cria SpawnGenerator independente (o obstacle list do clone
    // permanece intacto enquanto o original continua gerando).
    const w = createWorld(SEEDED);
    w.spawner!.generateUpTo(800, w.obstacles);
    const snap = cloneWorld(w);
    const snapIds = snap.obstacles.map((o) => o.id);
    expect(snapIds.length).toBeGreaterThan(0);
    // Avança o spawner do original além do ponto do clone.
    w.spawner!.generateUpTo(1600, w.obstacles);
    // O clone permanece intacto mesmo após o original gerar mais obstáculos.
    expect(snap.obstacles.map((o) => o.id)).toEqual(snapIds);
    expect(w.obstacles.map((o) => o.id)).not.toEqual(snapIds);
  });
});
