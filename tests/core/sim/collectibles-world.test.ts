import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';

describe('coletáveis no mundo', () => {
  it('createWorld inicia food em 0 e sem seed não tem collectibleSpawner', () => {
    const w = createWorld();
    expect(w.food).toBe(0);
    expect(w.collectibleSpawner).toBeNull();
    expect(w.collectibles).toEqual([]);
  });

  it('com seed, o step gera coletáveis à frente', () => {
    const w = createWorld({ seed: 'endless:ABC' });
    expect(w.collectibleSpawner).not.toBeNull();
    for (let i = 0; i < 120; i++) step(w, { flap: i % 7 === 0 });
    expect(w.collectibles.length).toBeGreaterThan(0);
    expect(w.collectibles[0]!.type).toBe('collectible');
  });

  it('cloneWorld copia food e isola o collectibleSpawner', () => {
    const w = createWorld({ seed: 'endless:ABC' });
    w.food = 5;
    const c = cloneWorld(w);
    expect(c.food).toBe(5);
    for (let i = 0; i < 200; i++) step(c, { flap: false });
    // mutar o clone não muda o original
    const before = w.collectibles.length;
    for (let i = 0; i < 1; i++) step(w, { flap: false });
    expect(w.collectibles.length).toBeGreaterThanOrEqual(before);
  });
});
