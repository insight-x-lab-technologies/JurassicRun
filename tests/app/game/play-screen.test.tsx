// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'preact';
import { PlayScreen } from '../../../src/app/screens/PlayScreen';
import { i18n } from '@services/i18n';
import type { GameHandle } from '../../../src/app/game/startGame';

// Sem isto o teste carrega o Phaser (canvas/WebGL) no happy-dom.
const handle: GameHandle = {
  stop: () => {},
  snapshot: () => ({ phase: 'ready', paused: false, gameOver: null, dying: false }),
  hud: () => null,
  restart: () => {},
};
vi.mock('../../../src/app/game/startGame', () => ({ startGame: () => handle }));

describe('PlayScreen', () => {
  let host: HTMLElement;

  beforeEach(async () => {
    await i18n.init();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('nunca renderiza a dica de girar o aparelho (o jogo roda em retrato)', () => {
    render(<PlayScreen />, host);
    expect(host.querySelector('.rotate-hint')).toBeNull();
  });

  it('não deixa resíduo da chave i18n do aviso de girar', () => {
    // i18next devolve a própria chave quando ela não existe.
    expect(i18n.t('rotateHint.message')).toBe('rotateHint.message');
  });
});
