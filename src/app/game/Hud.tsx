import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import { formatHudValues } from '@render/hud';
import type { HudLive } from './startGame';

/** HUD DOM in-game (W4): crisp, top-left, reusa formatHudValues + chaves hud.*. Não bloqueia o toque. */
export function Hud({ hud, fps }: { hud: HudLive; fps: number }): VNode {
  const v = formatHudValues({
    distance: hud.distance,
    food: hud.food,
    fps,
    level: hud.level,
    speed: hud.speed,
    seed: hud.seed,
    weather: hud.weather,
  });
  return (
    <div class="hud" aria-hidden="true">
      <span>{i18n.t('hud.distance', { value: v.distance })}</span>
      <span>{i18n.t('hud.food', { value: v.food })}</span>
      <span>{i18n.t('hud.level', { value: v.level })}</span>
      <span>{i18n.t('hud.weather', { value: i18n.t('weather.' + v.weather) })}</span>
      <span>{i18n.t('hud.speed', { value: v.speed })}</span>
      <span>{i18n.t('hud.seed', { value: v.seed })}</span>
      <span>{i18n.t('hud.fps', { value: v.fps })}</span>
    </div>
  );
}
