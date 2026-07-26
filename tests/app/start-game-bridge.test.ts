// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import type { HudLive, MatchSnapshot, GameHandle } from '../../src/app/game/startGame';

// Contrato de tipos da ponte (W4 + 9.5). Compila ⇒ o contrato vale.
describe('contrato da ponte startGame', () => {
  it('HudLive carrega efeitos, vidas extras e traço', () => {
    const hud: HudLive = {
      distance: 10, food: 2, level: 1, speed: 120, weather: 'clear', seed: 's',
      effects: [{ kind: 'shield', seconds: 5, fraction: 1 }],
      extraLives: 1,
      trait: 'magnet',
    };
    expect(hud.effects[0]!.kind).toBe('shield');
    expect(hud.trait).toBe('magnet');
  });

  it('MatchSnapshot não expõe mais o HUD (ele vem por GameHandle.hud())', () => {
    const snap: MatchSnapshot = { phase: 'ready', paused: false, gameOver: null, dying: false };
    expect(Object.keys(snap)).not.toContain('hud');
    const handle: Pick<GameHandle, 'hud'> = { hud: () => null };
    expect(handle.hud()).toBeNull();
  });
});
