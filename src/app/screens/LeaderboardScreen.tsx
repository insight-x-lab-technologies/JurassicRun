import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { leaderboardService, type LeaderboardEntry, type LeaderboardMode } from '@services/leaderboard';

const TABS: readonly LeaderboardMode[] = ['endless', 'daily', 'weekly'];
const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

function rankGlyph(index: number): string {
  return MEDALS[index] ?? `${index + 1}`;
}

function EntryRow({ entry, index }: { entry: LeaderboardEntry; index: number }): VNode {
  return (
    <li class="leaderboard__row" data-testid={`leaderboard-row-${index}`}>
      <span class="leaderboard__rank" aria-hidden={index < 3 ? 'true' : undefined}>
        {rankGlyph(index)}
      </span>
      <span class="leaderboard__score" aria-label={i18n.t('leaderboard.score')}>{entry.score}</span>
      <span class="leaderboard__detail">
        {i18n.t('leaderboard.distance')}: {entry.distance} · {i18n.t('leaderboard.food')}: {entry.food} · {i18n.t('leaderboard.nearMisses')}: {entry.nearMisses}
      </span>
      <span class="leaderboard__seed">{entry.seed}</span>
    </li>
  );
}

function entriesFor(mode: LeaderboardMode): readonly LeaderboardEntry[] {
  if (mode === 'endless') return leaderboardService.endless.value;
  if (mode === 'daily') return leaderboardService.daily.value;
  return leaderboardService.weekly.value;
}

export function LeaderboardScreen(): VNode {
  const [tab, setTab] = useState<LeaderboardMode>('endless');
  const entries = entriesFor(tab);

  return (
    <div class="screen leaderboard">
      <h1 class="screen__title">{i18n.t('leaderboard.title')}</h1>

      <div class="leaderboard__tabs" role="tablist">
        {TABS.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={tab === m ? 'true' : 'false'}
            class={`leaderboard__tab${tab === m ? ' leaderboard__tab--active' : ''}`}
            data-testid={`leaderboard-tab-${m}`}
            onClick={() => setTab(m)}
          >
            {i18n.t(`leaderboard.tab.${m}`)}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p class="leaderboard__empty">{i18n.t('leaderboard.empty')}</p>
      ) : (
        <ol class="leaderboard__list">
          {entries.map((entry, index) => (
            <EntryRow key={`${entry.seed}-${entry.achievedAt}`} entry={entry} index={index} />
          ))}
        </ol>
      )}

      <button type="button" class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
