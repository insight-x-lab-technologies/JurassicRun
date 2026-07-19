import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { onlineService } from '@services/online';
import {
  leaderboardService, type LeaderboardEntry, type LeaderboardMode, type CentralEntry,
} from '@services/leaderboard';

const TABS: readonly LeaderboardMode[] = ['endless', 'daily', 'weekly'];
const MEDAL_IMG: Record<number, string> = { 0: 'medal.gold', 1: 'medal.silver', 2: 'medal.bronze' };
function rankBadge(index: number): VNode | number {
  const m = MEDAL_IMG[index];
  return m
    ? <img class="medal" src={`${import.meta.env.BASE_URL}ui/${m}.png`} alt="" aria-hidden="true" />
    : index + 1;
}

function LocalRow({ entry, index }: { entry: LeaderboardEntry; index: number }): VNode {
  return (
    <li class="leaderboard__row" data-testid={`leaderboard-row-${index}`}>
      <span class="leaderboard__rank" aria-hidden={index < 3 ? 'true' : undefined}>{rankBadge(index)}</span>
      <span class="leaderboard__score" aria-label={i18n.t('leaderboard.score')}>{entry.score}</span>
      <span class="leaderboard__detail">
        {i18n.t('leaderboard.distance')}: {entry.distance} · {i18n.t('leaderboard.food')}: {entry.food} · {i18n.t('leaderboard.nearMisses')}: {entry.nearMisses}
      </span>
      <span class="leaderboard__seed">{entry.seed}</span>
    </li>
  );
}

function CentralRow({ entry, index, me }: { entry: CentralEntry; index: number; me: string | null }): VNode {
  const isMe = me !== null && entry.playerId === me;
  return (
    <li class={`leaderboard__row${isMe ? ' leaderboard__row--me' : ''}`} data-testid={`leaderboard-row-${index}`}>
      <span class="leaderboard__rank" aria-hidden={index < 3 ? 'true' : undefined}>{rankBadge(index)}</span>
      <span class="leaderboard__score" aria-label={i18n.t('leaderboard.score')}>{entry.score}</span>
      <span class="leaderboard__player" aria-label={i18n.t('leaderboard.player')}>{entry.playerName}</span>
      {entry.verified && (
        <span class="leaderboard__verified" title={i18n.t('leaderboard.verified')} aria-label={i18n.t('leaderboard.verified')}>✓</span>
      )}
      <span class="leaderboard__detail">
        {i18n.t('leaderboard.distance')}: {entry.distance} · {i18n.t('leaderboard.food')}: {entry.food} · {i18n.t('leaderboard.nearMisses')}: {entry.nearMisses}
      </span>
    </li>
  );
}

function centralFor(mode: LeaderboardMode): readonly CentralEntry[] {
  if (mode === 'endless') return leaderboardService.centralEndless.value;
  if (mode === 'daily') return leaderboardService.centralDaily.value;
  return leaderboardService.centralWeekly.value;
}
function localFor(mode: LeaderboardMode): readonly LeaderboardEntry[] {
  if (mode === 'endless') return leaderboardService.endless.value;
  if (mode === 'daily') return leaderboardService.daily.value;
  return leaderboardService.weekly.value;
}

export function LeaderboardScreen(): VNode {
  const [tab, setTab] = useState<LeaderboardMode>('endless');
  const isOnline = leaderboardService.centralAvailable.value;
  const central = centralFor(tab);
  const local = localFor(tab);
  const me = onlineService.globalPlayerId.value;
  const useCentral = isOnline;
  const empty = useCentral ? central.length === 0 : local.length === 0;

  return (
    <div class="screen leaderboard">
      <h1 class="screen__title">{i18n.t('leaderboard.title')}</h1>
      <p class="leaderboard__source" data-testid="leaderboard-source">
        {i18n.t(useCentral ? 'leaderboard.source.global' : 'leaderboard.source.local')}
      </p>

      <div class="leaderboard__tabs" role="tablist">
        {TABS.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={tab === m ? 'true' : 'false'}
            class={`leaderboard__tab${tab === m ? ' leaderboard__tab--active' : ''}`}
            data-testid={`leaderboard-tab-${m}`} onClick={() => setTab(m)}>
            {i18n.t(`leaderboard.tab.${m}`)}
          </button>
        ))}
      </div>

      {empty ? (
        <p class="leaderboard__empty">{i18n.t('leaderboard.empty')}</p>
      ) : (
        <ol class="leaderboard__list">
          {useCentral
            ? central.map((e, i) => <CentralRow key={`${e.playerId}-${e.seed}`} entry={e} index={i} me={me} />)
            : local.map((e, i) => <LocalRow key={`${e.seed}-${e.achievedAt}`} entry={e} index={i} />)}
        </ol>
      )}

      <button type="button" class="btn btn--ghost" onClick={() => back()}>{i18n.t('nav.back')}</button>
    </div>
  );
}
