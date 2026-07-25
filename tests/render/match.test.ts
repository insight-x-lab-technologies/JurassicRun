// tests/render/match.test.ts
import { describe, it, expect } from 'vitest';
import { MatchController } from '@render/match';
import type { MatchInit } from '@render/match';
import type { InputTimeline } from '@core/replay';
import { createWorld } from '@core/sim';
import { NullInputSource } from '@render/input';
import { DEATH_ANIM_SECONDS } from '@render/death';

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

  it('notifyFlap em dead é no-op (restart é explícito)', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    const seedBefore = m.seedLabel;
    m.notifyFlap();
    expect(m.phase).toBe('dead');
    expect(m.seedLabel).toBe(seedBefore);
  });

  it('restart em dead reinicia: nova seed, world novo, ready, onNewMatch chamado', () => {
    let resets = 0;
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onNewMatch: () => { resets++; },
    });
    m.notifyFlap();
    advanceUntilDead(m);
    expect(m.phase).toBe('dead');
    m.advance(DEATH_ANIM_SECONDS); // 9.3: espera a fase cosmética `dying` acabar (restart é bloqueado durante ela)

    m.restart();
    expect(m.phase).toBe('ready');
    expect(m.seedLabel).toBe('endless:TEST1');
    expect(m.world.tick).toBe(0);
    expect(m.world.alive).toBe(true);
    expect(resets).toBe(1);
  });

  it('restart fora de dead é no-op', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.restart(); // em ready
    expect(m.phase).toBe('ready');
    expect(m.seedLabel).toBe('endless:TEST0');
    m.notifyFlap(); // playing
    m.restart(); // em playing
    expect(m.phase).toBe('playing');
    expect(m.seedLabel).toBe('endless:TEST0');
  });

  it('o loop aponta para o world corrente após restart', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    m.advance(DEATH_ANIM_SECONDS); // 9.3: espera `dying` acabar antes de reiniciar
    m.restart(); // → ready, world novo
    expect(m.loop.world).toBe(m.world);
  });

  it('onGameOver dispara 1× na morte, com o world morto (food capturado)', () => {
    const deaths: number[] = [];
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onGameOver: (w) => deaths.push(w.food),
    });
    m.notifyFlap();            // ready → playing
    advanceUntilDead(m);       // roda steps até o mundo morrer ⇒ dead + hook
    expect(m.phase).toBe('dead');
    expect(m.world.alive).toBe(false);
    expect(deaths.length).toBe(1);
    m.advance(1 / 60);         // já morto: advance é no-op, não redispara
    expect(deaths.length).toBe(1);
  });

  it('onGameOver NÃO dispara em ready nem sem morrer', () => {
    let calls = 0;
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onGameOver: () => { calls++; },
    });
    m.advance(1);              // ready: no-op
    m.notifyFlap();            // playing
    m.advance(1 / 60);         // 1 step, mundo ainda vivo
    expect(m.world.alive).toBe(true);
    expect(calls).toBe(0);
  });

  it('recordedTimeline reflete os steps rodados na partida', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap(); // ready -> playing
    m.advance((1 / 60) * 3); // 3 steps
    const tl: InputTimeline = m.recordedTimeline();
    expect(tl).toHaveLength(3);
    expect(tl.every((f) => f.flap === false)).toBe(true); // NullInputSource
  });

  it('restart zera a timeline (loop fresco)', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    expect(m.recordedTimeline().length).toBeGreaterThan(0);
    m.advance(DEATH_ANIM_SECONDS); // 9.3: espera `dying` acabar antes de reiniciar
    m.restart(); // nova partida
    expect(m.recordedTimeline()).toEqual([]);
  });

  // --- 9.3: relógio cosmético de morte (deathElapsed/dying) ---------------------------------

  it('ao morrer, entra em dying com deathElapsed zerado', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    expect(m.phase).toBe('dead');
    expect(m.dying).toBe(true);
    expect(m.deathElapsed).toBe(0);
  });

  it('advance em dead acumula deathElapsed (tempo real) sem rodar steps nem redisparar onGameOver', () => {
    const deaths: number[] = [];
    const m = new MatchController(new NullInputSource(), makeFactory(), {
      onGameOver: () => { deaths.push(1); },
    });
    m.notifyFlap();
    advanceUntilDead(m);
    expect(deaths.length).toBe(1);
    const tickAtDeath = m.world.tick;

    m.advance(0.1);
    expect(m.deathElapsed).toBeCloseTo(0.1, 9);
    expect(m.world.tick).toBe(tickAtDeath); // sim continua congelada
    expect(deaths.length).toBe(1); // hook não redispara

    m.advance(0.2);
    expect(m.deathElapsed).toBeCloseTo(0.3, 9);
    expect(m.world.tick).toBe(tickAtDeath);
    expect(deaths.length).toBe(1);
  });

  it('deathElapsed satura em DEATH_ANIM_SECONDS e dying vira false', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);

    m.advance(DEATH_ANIM_SECONDS * 10); // bem além da duração
    expect(m.deathElapsed).toBe(DEATH_ANIM_SECONDS);
    expect(m.dying).toBe(false);
    expect(m.phase).toBe('dead'); // continua "morto" — só a fase cosmética terminou
  });

  it('restart() durante dying é no-op; depois que dying acaba, restart() funciona', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    const seedBefore = m.seedLabel;
    expect(m.dying).toBe(true);

    m.restart(); // ainda dying: no-op
    expect(m.phase).toBe('dead');
    expect(m.seedLabel).toBe(seedBefore);
    expect(m.dying).toBe(true);

    m.advance(DEATH_ANIM_SECONDS); // dying termina
    expect(m.dying).toBe(false);

    m.restart(); // agora funciona como antes
    expect(m.phase).toBe('ready');
    expect(m.seedLabel).not.toBe(seedBefore);
  });

  it('nova partida (após restart) zera deathElapsed e dying', () => {
    const m = new MatchController(new NullInputSource(), makeFactory());
    m.notifyFlap();
    advanceUntilDead(m);
    m.advance(DEATH_ANIM_SECONDS);
    m.restart();

    expect(m.phase).toBe('ready');
    expect(m.deathElapsed).toBe(0);
    expect(m.dying).toBe(false);
  });
});
