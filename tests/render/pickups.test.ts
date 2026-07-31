import { describe, it, expect } from 'vitest';
import { PowerupPickupCounter, effectMask } from '@render/pickups';
import type { WorldState } from '@core/sim';

/** Mundo mínimo para o contador: ele só lê `effects` e `extraLives`. */
const world = (
  kinds: readonly string[],
  extraLives = 0,
): WorldState =>
  ({
    effects: kinds.map((kind) => ({ kind, remaining: 60 })),
    extraLives,
  }) as unknown as WorldState;

describe('effectMask', () => {
  it('mundo sem efeitos ⇒ 0; kinds diferentes acendem bits diferentes', () => {
    expect(effectMask(world([]))).toBe(0);
    expect(effectMask(world(['shield']))).not.toBe(effectMask(world(['magnet'])));
    expect(effectMask(world(['shield', 'magnet']))).toBe(
      effectMask(world(['shield'])) | effectMask(world(['magnet'])),
    );
  });
});

describe('PowerupPickupCounter', () => {
  it('parte de zero e conta um efeito temporário novo', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([]));
    expect(c.count).toBe(0);
    c.observe(world(['shield']));
    expect(c.count).toBe(1);
  });

  it('não reconta o mesmo efeito enquanto ele continua ativo', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([]));
    c.observe(world(['shield']));
    c.observe(world(['shield']));
    c.observe(world(['shield']));
    expect(c.count).toBe(1);
  });

  it('conta de novo quando o efeito expira e é reapanhado', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([]));
    c.observe(world(['shield']));
    c.observe(world([]));
    c.observe(world(['shield']));
    expect(c.count).toBe(2);
  });

  it('kinds simultâneos distintos contam um cada', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([]));
    c.observe(world(['shield', 'magnet']));
    expect(c.count).toBe(2);
  });

  it('extraLife conta pelo incremento de extraLives', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([], 0));
    c.observe(world([], 1));
    expect(c.count).toBe(1);
  });

  it('bloquear um hit (extraLives cai) NÃO conta e não quebra o baseline', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([], 0));
    c.observe(world([], 1)); // apanhou
    c.observe(world([], 0)); // gastou bloqueando
    expect(c.count).toBe(1);
    c.observe(world([], 1)); // apanhou de novo
    expect(c.count).toBe(2);
  });

  it('reset rearma o baseline com o mundo dado e zera a contagem', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([]));
    c.observe(world(['shield']));
    c.reset(world(['shield'])); // partida nova já com efeito? baseline conta como visto
    expect(c.count).toBe(0);
    c.observe(world(['shield']));
    expect(c.count).toBe(0);
  });

  // `killOrRevive` (core) consome 1 extraLives E acende `shield` de graça no MESMO step.
  // O escudo de graça é consequência do bloqueio, não um pickup — não pode contar.
  it('bloquear um hit acende o shield de graça no mesmo step, mas isso NÃO conta como pickup', () => {
    const c = new PowerupPickupCounter();
    c.reset(world([], 1)); // 1 vida extra, sem efeitos
    c.observe(world(['shield'], 0)); // bloqueou: extraLives caiu 1→0 e shield de graça acendeu
    expect(c.count).toBe(0);
  });

  it('se o shield já estava ativo antes do bloqueio, também continua 0', () => {
    const c = new PowerupPickupCounter();
    c.reset(world(['shield'], 1)); // já com shield ativo + 1 vida extra
    c.observe(world(['shield'], 0)); // bloqueou: extraLives caiu, shield continua aceso
    expect(c.count).toBe(0);
  });
});
