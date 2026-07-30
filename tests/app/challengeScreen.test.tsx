// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'preact';
import { ChallengeBrief } from '@app/screens/ChallengeBrief';
import { buildChallengeBrief } from '@app/challenge/brief';
import { i18n } from '@services/i18n';

let host: HTMLElement;
beforeEach(async () => {
  // Padrão dos testes de tela existentes (ex.: trophies-screen.test.tsx): a apresentação usa
  // `i18n.t` no render, então a instância precisa estar inicializada antes de montar.
  await i18n.init();
  host = document.createElement('div');
  document.body.appendChild(host);
});

describe('ChallengeBrief', () => {
  it('mostra seed, as 3 regras e o botão de jogar', () => {
    const view = buildChallengeBrief({
      seed: 'daily:2026-07-29',
      localEntries: [{ seed: 'daily:2026-07-29', score: 42 }],
      centralEntries: [],
    });
    render(<ChallengeBrief mode="daily" view={view} onPlay={() => {}} onBack={() => {}} />, host);
    expect(host.textContent).toContain('2026-07-29');
    expect(host.querySelectorAll('.challenge-brief__rule')).toHaveLength(3);
    expect(host.querySelector('[data-testid="challenge-play"]')).not.toBeNull();
  });

  it('chama onPlay ao clicar em Jogar', () => {
    let played = 0;
    const view = buildChallengeBrief({ seed: 'weekly:2026-W31', localEntries: [], centralEntries: [] });
    render(<ChallengeBrief mode="weekly" view={view} onPlay={() => (played += 1)} onBack={() => {}} />, host);
    host.querySelector<HTMLButtonElement>('[data-testid="challenge-play"]')?.click();
    expect(played).toBe(1);
  });

  it('sem recorde mostra o placeholder de vazio', () => {
    const view = buildChallengeBrief({ seed: 'daily:2026-07-29', localEntries: [], centralEntries: [] });
    render(<ChallengeBrief mode="daily" view={view} onPlay={() => {}} onBack={() => {}} />, host);
    expect(host.querySelector('[data-testid="challenge-yourbest"]')?.textContent).toContain('—');
  });
});
