// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { DonateScreen } from '../../src/app/screens/DonateScreen';
import { DONATE_OPTIONS, openDonation } from '../../src/app/home/donate';
import { i18n } from '@services/i18n';

let container: HTMLDivElement;

beforeEach(async () => {
  await i18n.init();
  container = document.createElement('div');
  document.body.appendChild(container);
  render(<DonateScreen />, container);
});

afterEach(() => {
  render(null, container);
  container.remove();
  vi.restoreAllMocks();
});

describe('DonateScreen', () => {
  it('mostra "por que doar" e "como doar"', () => {
    const txt = container.textContent ?? '';
    for (const key of ['donate.title', 'donate.whyTitle', 'donate.whyBody', 'donate.howTitle', 'donate.howBody']) {
      expect(txt, key).toContain(i18n.t(key));
    }
  });

  it('tem um card por plataforma suportada', () => {
    for (const option of DONATE_OPTIONS) {
      const card = container.querySelector(`[data-testid="donate-${option.id}"]`);
      expect(card, option.id).not.toBeNull();
      expect(card?.textContent).toContain(option.brand);
    }
  });

  it('as URLs são as das contas reais do estúdio', () => {
    const urls = DONATE_OPTIONS.map((o) => o.url);
    expect(urls).toContain('https://buymeacoffee.com/insight.x.lab.game.studio');
    expect(urls).toContain('https://ko-fi.com/insightxlabgamestudio');
  });

  it('cada botão abre a URL da SUA plataforma', () => {
    for (const option of DONATE_OPTIONS) {
      const openUrl = vi.fn();
      openDonation({ openUrl }, option.url);
      expect(openUrl).toHaveBeenCalledWith(option.url);
    }
  });
});
