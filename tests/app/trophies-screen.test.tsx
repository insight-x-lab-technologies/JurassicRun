// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { TrophiesScreen } from '@app/screens/TrophiesScreen';
import { i18n } from '@services/i18n';
import { trophyService, TROPHY_CATALOG } from '@services/trophy';
import { memoryTrophyStorage } from '@services/trophy/storage';

describe('TrophiesScreen', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    trophyService.init(memoryTrophyStorage());
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renderiza um card por conquista do catálogo', () => {
    render(<TrophiesScreen />, container);
    const cards = container.querySelectorAll('[data-testid^="trophy-card-"]');
    expect(cards.length).toBe(TROPHY_CATALOG.length);
  });

  it('mostra a mensagem vazia quando nada foi desbloqueado', () => {
    render(<TrophiesScreen />, container);
    expect(container.querySelector('.trophies__empty')).not.toBeNull();
  });

  it('marca desbloqueado vs bloqueado após uma partida (firstFlight)', async () => {
    trophyService.recordMatch({ distance: 0, food: 0, nearMisses: 0, score: 0 });
    await Promise.resolve();
    render(<TrophiesScreen />, container);
    expect(
      container.querySelector('[data-testid="trophy-card-firstFlight"]')?.getAttribute('data-unlocked'),
    ).toBe('true');
    expect(
      container.querySelector('[data-testid="trophy-card-centurion"]')?.getAttribute('data-unlocked'),
    ).toBe('false');
  });
});
