import { describe, it, expect } from 'vitest';
import { createWorld, cloneWorld, step } from '@core/sim';
import { isEffectActive } from '@core/powerup';
import type { InputFrame } from '@core/sim';

const noFlap: InputFrame = { flap: false };
const BASE = { worldHeight: 600, startY: 300, gravity: 1200, flapSpeed: 350, scrollSpeed: 200 };

describe('traço no mundo', () => {
  it('default é none quando não passado', () => {
    expect(createWorld({ ...BASE }).trait).toBe('none');
  });

  it('startLife começa com 1 vida extra', () => {
    expect(createWorld({ ...BASE, trait: 'startLife' }).extraLives).toBe(1);
    expect(createWorld({ ...BASE, trait: 'none' }).extraLives).toBe(0);
  });

  it('headStart começa com escudo ativo', () => {
    const w = createWorld({ ...BASE, trait: 'headStart' });
    expect(isEffectActive(w.effects, 'shield')).toBe(true);
    expect(isEffectActive(createWorld({ ...BASE }).effects, 'shield')).toBe(false);
  });

  it('doubleFood dá 2 de comida por coletável (via collect)', () => {
    // mundo sem spawner; injeta um coletável sob o dino e coleta manualmente via step de colisão
    const w = createWorld({ ...BASE, trait: 'doubleFood' });
    const dino = w.pterodactyl.transform.position;
    w.collectibles.push({
      id: 1, type: 'collectible', tags: ['bird.coin'],
      transform: { position: { x: dino.x, y: dino.y } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: { kind: 'circle', radius: 6 },
    });
    step(w, noFlap);
    expect(w.food).toBe(2);
  });

  it('cloneWorld copia o trait', () => {
    const w = createWorld({ ...BASE, trait: 'magnet' });
    const cloned = cloneWorld(w);
    expect(cloned.trait).toBe('magnet');
    // cópia independente: mudar o original não deve afetar o clone (campo escalar, mas
    // exercitamos cloneWorld de fato em vez de só ler w.trait).
    expect(cloned).not.toBe(w);
  });
});
