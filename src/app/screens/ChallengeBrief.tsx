import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import type { ChallengeBriefView, ChallengeRule } from '../challenge/brief';

const RULE_LABEL: Record<ChallengeRule['kind'], string> = {
  weather: 'challenge.brief.ruleWeather',
  bannedPowerup: 'challenge.brief.ruleBannedPowerup',
  trait: 'challenge.brief.ruleTrait',
};

function scoreText(value: number | null): string {
  return value === null ? i18n.t('challenge.brief.none') : String(Math.floor(value));
}

/**
 * Apresentação PURA do briefing (recebe `view` já pronta): seed/período, recordes local e
 * central, e as regras vigentes da seed (clima travado, power-up banido, traço travado).
 * O título NÃO tem chave própria em `challenge.brief` — reaproveita `nav.daily`/`nav.weekly`
 * (mesma string, já existente nos 10 locales; elimina a duplicação apontada no review da Task 5).
 */
export function ChallengeBrief({
  mode, view, onPlay, onBack,
}: {
  mode: 'daily' | 'weekly';
  view: ChallengeBriefView;
  onPlay: () => void;
  onBack: () => void;
}): VNode {
  return (
    <div class="screen challenge-brief">
      <h1 class="screen__title challenge-brief__title">
        {i18n.t(mode === 'daily' ? 'nav.daily' : 'nav.weekly')}
      </h1>
      <p class="challenge-brief__subtitle">{i18n.t('challenge.brief.subtitle')}</p>

      <dl class="challenge-brief__stats">
        <div class="challenge-brief__stat">
          <dt>{i18n.t('challenge.brief.seed')}</dt>
          <dd data-testid="challenge-seed">{view.periodLabel}</dd>
        </div>
        <div class="challenge-brief__stat">
          <dt>{i18n.t('challenge.brief.yourBest')}</dt>
          <dd data-testid="challenge-yourbest">{scoreText(view.yourBest)}</dd>
        </div>
        <div class="challenge-brief__stat">
          <dt>{i18n.t('challenge.brief.worldBest')}</dt>
          <dd data-testid="challenge-worldbest">{scoreText(view.worldBest)}</dd>
        </div>
      </dl>

      <h2 class="challenge-brief__rules-title">{i18n.t('challenge.brief.rules')}</h2>
      <ul class="challenge-brief__rules">
        {view.rules.map((rule) => (
          <li class="challenge-brief__rule" key={rule.kind}>
            {i18n.t(RULE_LABEL[rule.kind], { value: i18n.t(rule.valueKey) })}
          </li>
        ))}
      </ul>

      <div class="challenge-brief__actions">
        <button class="btn" data-testid="challenge-play" onClick={onPlay}>
          {i18n.t('challenge.brief.play')}
        </button>
        <button class="btn btn--ghost" onClick={onBack}>
          {i18n.t('nav.back')}
        </button>
      </div>
    </div>
  );
}
