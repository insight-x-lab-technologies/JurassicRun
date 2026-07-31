// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'preact';
import { PlayScreen, showTapZone } from '../../../src/app/screens/PlayScreen';
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

  it('mostra a zona de toque enquanto a partida está em curso', () => {
    render(<PlayScreen />, host);
    const zone = host.querySelector('.play-screen__tap');
    expect(zone).not.toBeNull();
    // Decorativa: quem trata o toque é o listener de `window` de bindGameControls.
    expect(zone?.getAttribute('aria-hidden')).toBe('true');
    expect(zone?.textContent).toBe(i18n.t('match.tapArea'));
    expect(i18n.t('match.tapArea')).not.toBe('match.tapArea'); // chave existe de fato
  });
});

describe('PlayScreen em Game Over', () => {
  it('esconde a zona de toque quando a partida acabou', async () => {
    await i18n.init();
    const host = document.createElement('div');
    document.body.appendChild(host);
    // A zona só some quando o snapshot vira `dead`; o componente lê o snapshot no rAF, então
    // aqui a asserção é sobre a REGRA de renderização, exercitada pelo helper puro.
    expect(showTapZone({ phase: 'dead', paused: false, gameOver: null, dying: false })).toBe(false);
    expect(showTapZone({ phase: 'playing', paused: true, gameOver: null, dying: false })).toBe(false);
    expect(showTapZone({ phase: 'playing', paused: false, gameOver: null, dying: false })).toBe(true);
    expect(showTapZone({ phase: 'ready', paused: false, gameOver: null, dying: false })).toBe(true);
    render(null, host);
  });
});
