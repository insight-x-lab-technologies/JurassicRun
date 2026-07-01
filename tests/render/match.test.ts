// tests/render/match.test.ts
import { describe, it, expect } from 'vitest';
import { MatchController } from '@render/match';
import type { MatchInit } from '@render/match';
import { createWorld } from '@core/sim';
import { NullInputSource } from '@render/input';

// Factory determinística: seeds numeradas + mundo com seed real (dino cai e morre sem flap).
function makeFactory(): () => MatchInit {
  let n = 0;
  return () => {
    const seedLabel = `endless:TEST${n++}`;
    return { world: createWorld({ seed: seedLabel }), seedLabel };
  };
}

// Avança tempo suficiente (s) para o dino cair do startY e morrer no chão.
function advanceUntilDead(m: MatchController, maxSeconds = 5): void {
  let t = 0;
  while (m.phase !== 'dead' && t < maxSeconds) {
    m.advance(1 / 60);
    t += 1 / 60;
  }
}

describe('MatchController', () => {
  it('nasce em ready com a primeira partida montada', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    expect(m.phase).toBe('ready');
    expect(m.seedLabel).toBe('endless:TEST0');
    expect(m.world.tick).toBe(0);
  });

  it('advance em ready é no-op (sim congelada)', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.advance(1);
    expect(m.world.tick).toBe(0);
    expect(m.world.distance).toBe(0);
    expect(m.phase).toBe('ready');
  });

  it('notifyFlap em ready inicia playing e advance passa a rodar steps', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    expect(m.phase).toBe('playing');
    m.advance(1 / 60);
    expect(m.world.tick).toBe(1);
  });

  it('em playing, a morte do mundo leva a dead', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    expect(m.phase).toBe('dead');
    expect(m.world.alive).toBe(false);
  });

  it('notifyFlap em playing é no-op (mesma partida/seed)', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    m.advance(1 / 60);
    const seedBefore = m.seedLabel;
    m.notifyFlap();
    expect(m.phase).toBe('playing');
    expect(m.seedLabel).toBe(seedBefore);
  });

  it('notifyFlap em dead reinicia: nova seed, world novo, ready, onNewMatch chamado', () => {
    let resets = 0;
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onNewMatch: () => { resets++; },
    });
    m.notifyFlap();
    advanceUntilDead(m);
    expect(m.phase).toBe('dead');

    m.notifyFlap(); // restart
    expect(m.phase).toBe('ready');
    expect(m.seedLabel).toBe('endless:TEST1');
    expect(m.world.tick).toBe(0);
    expect(m.world.alive).toBe(true);
    expect(resets).toBe(1);
  });

  it('o loop aponta para o world corrente após restart', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    m.notifyFlap(); // restart → ready, world novo
    expect(m.loop.world).toBe(m.world);
  });
});
