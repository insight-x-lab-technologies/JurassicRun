import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import { formatGameOverStats } from '@render/gameover';
import type { GameOverStats } from './startGame';

/** Overlay DOM de Game Over (W3): diálogo emoldurado sobre o canvas. */
export function GameOverOverlay(
  { stats, onRestart, onQuit }: { stats: GameOverStats; onRestart: () => void; onQuit: () => void },
): VNode {
  const v = formatGameOverStats({ distance: stats.distance, food: stats.food, nearMisses: stats.nearMisses });
  return (
    <div class="gameover" role="dialog" aria-modal="true">
      <h2 class="gameover__title screen__title">{i18n.t('gameover.title')}</h2>
      {stats.newRecord && (
        <p class="gameover__badge" data-testid="gameover-record">
          {i18n.t('gameover.newRecord')}
        </p>
      )}
      <dl class="gameover__stats">
        <div>
          <span aria-hidden="true">📍</span> {i18n.t('gameover.distance', { value: v.distance })}
        </div>
        <div>
          <span aria-hidden="true">🍖</span> {i18n.t('gameover.food', { value: v.food })}
        </div>
        <div>
          <span aria-hidden="true">⚠️</span> {i18n.t('gameover.nearMisses', { value: v.nearMisses })}
        </div>
      </dl>
      <p class="gameover__coins">🪙 {i18n.t('gameover.coinsEarned', { value: stats.coins })}</p>
      <div class="gameover__actions">
        <button class="btn" data-testid="gameover-restart" onClick={onRestart}>
          {i18n.t('gameover.restart')}
        </button>
        <button class="btn btn--ghost" data-testid="gameover-quit" onClick={onQuit}>
          {i18n.t('gameover.quit')}
        </button>
      </div>
    </div>
  );
}
