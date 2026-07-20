// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { GameOverOverlay } from '../../src/app/game/GameOverOverlay';

describe('GameOverOverlay', () => {
  it('renderiza stats + botões e chama Reiniciar', () => {
    const onRestart = vi.fn();
    const host = document.createElement('div');
    render(
      <GameOverOverlay
        stats={{ distance: 100, food: 3, nearMisses: 1, score: 50, coins: 3, newRecord: true }}
        onRestart={onRestart}
        onQuit={() => {}}
      />,
      host,
    );
    expect(host.querySelector('[data-testid="gameover-record"]')).not.toBeNull();
    (host.querySelector('[data-testid="gameover-restart"]') as HTMLButtonElement).click();
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('sem badge de recorde quando newRecord=false', () => {
    const host = document.createElement('div');
    render(
      <GameOverOverlay
        stats={{ distance: 1, food: 0, nearMisses: 0, score: 1, coins: 0, newRecord: false }}
        onRestart={() => {}}
        onQuit={() => {}}
      />,
      host,
    );
    expect(host.querySelector('[data-testid="gameover-record"]')).toBeNull();
  });
});
