import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import type { PowerupKind } from '@core/powerup';
import type { DinoTrait } from '@core/dino';
import type { HudLive } from './startGame';

/** Glifos (emoji = glifo de fonte, não asset ⇒ sem asset-spec; precedente do rotate-hint). */
const GLYPH: Readonly<Record<PowerupKind, string>> = {
  shield: '🛡', slowMo: '⏳', magnet: '🧲', doubleCoin: '✨', extraLife: '❤',
};
const TRAIT_GLYPH = '🥚';

/** Chips de feedback in-game (9.5): efeitos temporários (com barra), vidas extras e traço.
 *  Cosmético e duplicado no canvas ⇒ aria-hidden, como o HUD do W4. */
export function EffectBadges({ hud }: { hud: HudLive }): VNode {
  return (
    <div class="effect-badges" aria-hidden="true">
      {hud.effects.map((e) => (
        <div class="effect-badge" key={e.kind}>
          <span class="effect-badge__glyph">{GLYPH[e.kind]}</span>
          <span class="effect-badge__label">{i18n.t('powerup.' + e.kind + '.name')}</span>
          <span class="effect-badge__time">{i18n.t('hud.seconds', { value: e.seconds })}</span>
          <span class="effect-badge__bar">
            <span class="effect-badge__bar-fill" style={{ width: e.fraction * 100 + '%' }} />
          </span>
        </div>
      ))}
      {hud.extraLives > 0 && (
        <div class="effect-badge effect-badge--lives">
          <span class="effect-badge__glyph">{GLYPH.extraLife}</span>
          <span class="effect-badge__label">{i18n.t('powerup.extraLife.name')}</span>
          <span class="effect-badge__time">{i18n.t('hud.extraLives', { value: hud.extraLives })}</span>
        </div>
      )}
      {hud.trait !== 'none' && (
        <div class="effect-badge effect-badge--trait">
          <span class="effect-badge__glyph">{TRAIT_GLYPH}</span>
          <span class="effect-badge__label">{i18n.t('trait.' + (hud.trait as DinoTrait) + '.name')}</span>
        </div>
      )}
    </div>
  );
}
