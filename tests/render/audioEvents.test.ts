import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld } from '@core/sim';
import type { WorldState } from '@core/sim';
import { AudioEventDetector } from '@render/audioEvents';
import type { SfxId } from '@services/audio';

let world: WorldState;
let det: AudioEventDetector;
const out: SfxId[] = [];

beforeEach(() => {
  world = createWorld({ seed: 'audio-events' });
  det = new AudioEventDetector();
  det.reset(world);
});

describe('AudioEventDetector', () => {
  it('nada muda ⇒ nenhum evento', () => {
    expect(det.poll(world, out)).toEqual([]);
  });

  it('borda de flap dispara uma vez', () => {
    world.lastFlap = true;
    expect(det.poll(world, out)).toEqual(['flap']);
    expect(det.poll(world, out)).toEqual([]); // segurado, sem nova borda
    world.lastFlap = false;
    expect(det.poll(world, out)).toEqual([]);
    world.lastFlap = true;
    expect(det.poll(world, out)).toEqual(['flap']);
  });

  it('comida coletada dispara coin', () => {
    world.food += 1;
    expect(det.poll(world, out)).toEqual(['coin']);
  });

  it('near-miss dispara nearMiss', () => {
    world.nearMisses += 1;
    expect(det.poll(world, out)).toEqual(['nearMiss']);
  });

  it('subir de nível dispara levelUp', () => {
    world.level += 1;
    expect(det.poll(world, out)).toEqual(['levelUp']);
  });

  it('novo efeito ativo dispara powerup', () => {
    world.effects.push({ kind: 'shield', remaining: 300 });
    expect(det.poll(world, out)).toEqual(['powerup']);
    expect(det.poll(world, out)).toEqual([]); // mesmo efeito, sem repetir
  });

  it('ganhar vida extra dispara powerup; perder dispara block', () => {
    world.extraLives += 1;
    expect(det.poll(world, out)).toEqual(['powerup']);
    world.extraLives -= 1;
    expect(det.poll(world, out)).toEqual(['block']);
  });

  it('morte dispara hit', () => {
    world.alive = false;
    expect(det.poll(world, out)).toEqual(['hit']);
    expect(det.poll(world, out)).toEqual([]);
  });

  it('vários eventos no mesmo poll', () => {
    world.food += 1;
    world.nearMisses += 1;
    world.alive = false;
    expect(det.poll(world, out).sort()).toEqual(['coin', 'hit', 'nearMiss']);
  });

  it('reset religa o baseline (restart não dispara nada)', () => {
    world.food += 5;
    world.level += 2;
    det.reset(world);
    expect(det.poll(world, out)).toEqual([]);
  });

  it('reusa o array de saída', () => {
    world.food += 1;
    const returned = det.poll(world, out);
    expect(returned).toBe(out);
  });
});
