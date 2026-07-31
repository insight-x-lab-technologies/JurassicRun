// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { GameOverOverlay } from '../../src/app/game/GameOverOverlay';
import { i18n } from '@services/i18n';

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

  it('mostra uma única linha de moeda, com o valor creditado, e nenhuma de comida', async () => {
    await i18n.init(); // gameover.coinsEarned precisa do i18n inicializado p/ traduzir de fato
    const host = document.createElement('div');
    render(
      <GameOverOverlay
        // coins ≠ food de propósito: prova que a tela lê o valor creditado, não a comida crua.
        stats={{ distance: 100, food: 3, nearMisses: 1, score: 50, coins: 7, newRecord: false }}
        onRestart={() => {}}
        onQuit={() => {}}
      />,
      host,
    );
    expect(host.querySelectorAll('.gameover__stats > div').length).toBe(2); // distância + quase-colisões
    expect(host.textContent).not.toContain('🍖');
    expect(host.querySelectorAll('.gameover__coins').length).toBe(1);
    expect(host.querySelector('.gameover__coins')!.textContent).toContain('7');
    expect(host.querySelector('.gameover__coins')!.textContent).not.toContain('3');
  });
});
