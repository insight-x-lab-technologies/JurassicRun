import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import type { Entity } from '@core/sim';
import { SpawnGenerator, DEFAULT_SPAWN_CONFIG } from '@core/spawn';

function run(seed: string, upTo: number): Entity[] {
  const g = new SpawnGenerator(createRng(seed).fork('obstacles'), DEFAULT_SPAWN_CONFIG);
  const out: Entity[] = [];
  g.generateUpTo(upTo, out);
  return out;
}

describe('determinismo do spawn de obstáculos', () => {
  it('mesma seed ⇒ mesma sequência', () => {
    expect(run('endless:ABC', 4000)).toEqual(run('endless:ABC', 4000));
  });

  it('seeds diferentes ⇒ sequências diferentes', () => {
    expect(run('endless:ABC', 4000)).not.toEqual(run('endless:XYZ', 4000));
  });

  it('independência de batching: uma chamada == várias incrementais', () => {
    const single = run('endless:ABC', 4000);

    const g = new SpawnGenerator(createRng('endless:ABC').fork('obstacles'), DEFAULT_SPAWN_CONFIG);
    const incremental: Entity[] = [];
    for (let x = 0; x <= 4000; x += 137) g.generateUpTo(x, incremental);
    g.generateUpTo(4000, incremental);

    expect(incremental).toEqual(single);
  });
});
