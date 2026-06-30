import { describe, it, expect, vi } from 'vitest';
import { NullInputSource, FlapInputSource, PauseController } from '@render/input';

describe('NullInputSource', () => {
  it('nunca pede flap', () => {
    const src = new NullInputSource();
    expect(src.sample()).toEqual({ flap: false });
    expect(src.sample()).toEqual({ flap: false });
  });

  it('alocação-zero (reuso): mesma referência entre samples', () => {
    const s = new NullInputSource();
    expect(s.sample()).toBe(s.sample());
  });
});

describe('FlapInputSource', () => {
  it('inicial: sample retorna flap false', () => {
    const s = new FlapInputSource();
    expect(s.sample().flap).toBe(false);
  });

  it('press/release: press ativa, release desativa no próximo sample', () => {
    const s = new FlapInputSource();
    s.press('a');
    expect(s.sample().flap).toBe(true);
    s.release('a');
    expect(s.sample().flap).toBe(false);
  });

  it('held por vários samples: flap true em todos enquanto segurado', () => {
    const s = new FlapInputSource();
    s.press('a');
    expect(s.sample().flap).toBe(true);
    expect(s.sample().flap).toBe(true);
    expect(s.sample().flap).toBe(true);
  });

  it('multi-fonte: soltar uma mantém flap se outra ainda ativa', () => {
    const s = new FlapInputSource();
    s.press('a');
    s.press('b');
    s.release('a');
    expect(s.sample().flap).toBe(true);
    s.release('b');
    expect(s.sample().flap).toBe(false);
  });

  it('autorepeat/dedup: mesmo id repetido, um release desfaz', () => {
    const s = new FlapInputSource();
    s.press('a');
    s.press('a');
    s.release('a');
    expect(s.sample().flap).toBe(false);
  });

  it('latch (tap sub-frame): press+release sem sample ⇒ exatamente 1 flap', () => {
    const s = new FlapInputSource();
    s.press('a');
    s.release('a');
    // sem sample entre press e release
    expect(s.sample().flap).toBe(true);   // latch garante 1 flap
    expect(s.sample().flap).toBe(false);  // e só 1
  });

  it('alocação-zero (reuso): mesma referência entre samples', () => {
    const s = new FlapInputSource();
    expect(s.sample()).toBe(s.sample());
  });

  it('reset/anti-fantasma: reset zera held e latch', () => {
    const s = new FlapInputSource();
    s.press('a');
    s.reset();
    expect(s.sample().flap).toBe(false);
  });

  it('reset zera também latch pendente', () => {
    const s = new FlapInputSource();
    s.press('a');
    s.release('a');
    s.reset();
    expect(s.sample().flap).toBe(false);
  });
});

describe('PauseController', () => {
  it('inicial: paused === false', () => {
    const p = new PauseController();
    expect(p.paused).toBe(false);
  });

  it('toggle alterna paused', () => {
    const p = new PauseController();
    p.toggle();
    expect(p.paused).toBe(true);
    p.toggle();
    expect(p.paused).toBe(false);
  });

  it('pause() é idempotente (2× → ainda true)', () => {
    const p = new PauseController();
    p.pause();
    p.pause();
    expect(p.paused).toBe(true);
  });

  it('resume() é idempotente (2× → ainda false)', () => {
    const p = new PauseController();
    p.pause();
    p.resume();
    p.resume();
    expect(p.paused).toBe(false);
  });

  it('onPause chamado exatamente 1× ao entrar em pausa', () => {
    const p = new PauseController();
    const cb = vi.fn();
    p.onPause = cb;
    p.pause();
    p.pause(); // idempotente — não dispara de novo
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('onPause não chamado no resume', () => {
    const p = new PauseController();
    const cb = vi.fn();
    p.onPause = cb;
    p.pause();
    p.resume();
    expect(cb).toHaveBeenCalledTimes(1); // só ao pausar
  });
});
