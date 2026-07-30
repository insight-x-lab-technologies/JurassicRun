// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { App } from '@app/App';
import { navigate, resetToHome } from '@app/router';
import { profileService } from '@services/profile';

// startGame é dinâmico e monta Phaser; interceptamos para o smoke não subir WebGL.
// Retorna o shape GameHandle {stop,snapshot,restart} (contrato do W3), não só `stop`.
vi.mock('@app/game/startGame', () => ({
  startGame: vi.fn(() => ({
    stop: () => {},
    snapshot: () => ({ phase: 'ready', paused: false, gameOver: null }),
    hud: () => null,
    restart: () => {},
  })),
}));

describe('App — rotas de desafio', () => {
  beforeEach(() => {
    resetToHome();
    profileService.init(); // garante um perfil ativo (ou onboarding); ver nota abaixo
  });

  it('renderiza o briefing e, ao Jogar, a PlayScreen (canvas) nas rotas daily e weekly', async () => {
    // pré-condição: um perfil ativo para passar do onboarding
    if (profileService.activeProfile.value === null) profileService.create('Tester');

    const host = document.createElement('div');
    navigate('daily');
    render(<App />, host);
    // Item 9.9: briefing primeiro (seed/recordes/regras), jogo só após "Jogar".
    const dailyPlay = host.querySelector<HTMLButtonElement>('[data-testid="challenge-play"]');
    expect(dailyPlay).not.toBeNull();
    dailyPlay?.click();
    await Promise.resolve();
    expect(host.querySelector('.play-screen__canvas')).not.toBeNull();

    navigate('weekly');
    render(<App />, host);
    const weeklyPlay = host.querySelector<HTMLButtonElement>('[data-testid="challenge-play"]');
    expect(weeklyPlay).not.toBeNull();
    weeklyPlay?.click();
    await Promise.resolve();
    expect(host.querySelector('.play-screen__canvas')).not.toBeNull();

    render(null, host); // cleanup
  });
});
