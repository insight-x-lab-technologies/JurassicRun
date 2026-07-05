// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { NestScreen } from '@app/screens/NestScreen';
import { i18n } from '@services/i18n';
import { nestService } from '@services/nest';
import { memoryNestStorage } from '@services/nest/storage';
import { STARTER_DINO_ID, DINO_ROSTER } from '@services/nest/roster';

describe('NestScreen', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    nestService.init(memoryNestStorage());
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renderiza um card por dino do roster', () => {
    render(<NestScreen />, container);
    expect(container.querySelectorAll('.dino-card').length).toBe(DINO_ROSTER.length);
  });

  it('marca o starter como Ativo e dinos pagos como não-compráveis (saldo 0)', () => {
    render(<NestScreen />, container);
    const starterCard = container.querySelector(`[data-testid="dino-card-${STARTER_DINO_ID}"]`)!;
    expect(starterCard.textContent).toContain(i18n.t('nest.active'));
    const paid = DINO_ROSTER.find((d) => d.price > 0)!;
    const buyBtn = container.querySelector(`[data-testid="dino-buy-${paid.id}"]`) as HTMLButtonElement;
    expect(buyBtn.disabled).toBe(true); // saldo 0 < preço
  });
});
