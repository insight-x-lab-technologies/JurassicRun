import { describe, it, expect } from 'vitest';
import { createRng } from '@core/rng';
import type { Entity } from '@core/sim';
import {
  SpawnGenerator,
  COLLECTIBLE_CATALOG,
  OBSTACLE_CATALOG,
  DEFAULT_COLLECTIBLE_CONFIG,
  DEFAULT_SPAWN_CONFIG,
} from '@core/spawn';

function cols(seed: string, upTo: number): Entity[] {
  const g = new SpawnGenerator(createRng(seed).fork('collectibles'), DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG, 'collectible');
  const out: Entity[] = [];
  g.generateUpTo(upTo, out);
  return out;
}

describe('determinismo dos coletáveis', () => {
  it('mesma seed ⇒ mesma sequência', () => {
    expect(cols('endless:ABC', 4000)).toEqual(cols('endless:ABC', 4000));
  });

  it('seeds diferentes ⇒ sequências diferentes', () => {
    expect(cols('endless:ABC', 4000)).not.toEqual(cols('endless:XYZ', 4000));
  });

  it('independência de batching: uma chamada == várias incrementais', () => {
    const single = cols('endless:ABC', 4000);
    const g = new SpawnGenerator(createRng('endless:ABC').fork('collectibles'), DEFAULT_COLLECTIBLE_CONFIG, COLLECTIBLE_CATALOG, 'collectible');
    const inc: Entity[] = [];
    for (let x = 0; x <= 4000; x += 137) g.generateUpTo(x, inc);
    g.generateUpTo(4000, inc);
    expect(inc).toEqual(single);
  });

  it('stream de coletáveis é independente do de obstáculos (mesma seed)', () => {
    const obsGen = new SpawnGenerator(createRng('endless:ABC').fork('obstacles'), DEFAULT_SPAWN_CONFIG, OBSTACLE_CATALOG, 'obstacle');
    const obs: Entity[] = [];
    obsGen.generateUpTo(4000, obs);
    const obsXs = obs.map((e) => e.transform.position.x);
    const colXs = cols('endless:ABC', 4000).map((e) => e.transform.position.x);
    expect(colXs).not.toEqual(obsXs);
  });
});
