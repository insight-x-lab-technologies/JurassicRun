// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { LeaderboardScreen } from '@app/screens/LeaderboardScreen';
import { i18n } from '@services/i18n';
import { leaderboardService } from '@services/leaderboard';
import { memoryLeaderboardStorage } from '@services/leaderboard/storage';
import { initialLeaderboardState } from '@services/leaderboard/store';

describe('LeaderboardScreen', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    await i18n.init();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container); // desmonta
    container.remove();
  });

  it('shows the empty state for a mode with no records', () => {
    leaderboardService.init(memoryLeaderboardStorage());
    render(<LeaderboardScreen />, container);
    expect(container.textContent).toContain(i18n.t('leaderboard.empty'));
  });

  it('lists endless entries ranked by score with medal for #1', () => {
    leaderboardService.init(
      memoryLeaderboardStorage({
        ...initialLeaderboardState(),
        endless: [
          { seed: 'endless:A', score: 90, distance: 200, food: 3, nearMisses: 1, achievedAt: 2 },
          { seed: 'endless:B', score: 40, distance: 80, food: 1, nearMisses: 0, achievedAt: 1 },
        ],
      }),
    );
    render(<LeaderboardScreen />, container);
    expect(container.textContent).toContain('90');
    expect(container.textContent).toContain('40');
    expect(container.textContent).toContain('🥇');
  });

  it('switches tabs to show daily entries', async () => {
    leaderboardService.init(
      memoryLeaderboardStorage({
        ...initialLeaderboardState(),
        daily: [
          { seed: 'daily:2026-07-07', score: 55, distance: 120, food: 2, nearMisses: 0, achievedAt: 1 },
        ],
      }),
    );
    render(<LeaderboardScreen />, container);
    expect(container.textContent).toContain(i18n.t('leaderboard.empty'));
    const dailyTab = container.querySelector('[data-testid="leaderboard-tab-daily"]') as HTMLButtonElement;
    dailyTab.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(container.textContent).toContain('55');
  });
});
