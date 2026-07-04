import type { WeatherKind, WeatherPhysics } from './types';
import {
  RAIN_GRAVITY_SCALE,
  WIND_UPDRAFT,
  STORM_GRAVITY_SCALE,
  STORM_DOWNDRAFT,
  SNOW_GRAVITY_SCALE,
} from './constants';

/** Ordem estável dos climas (HUD/registro determinístico). */
export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'rain', 'wind', 'storm', 'snow'];

/** Climas sorteáveis pelo gerador (inclui 'clear' p/ trechos calmos; peso uniforme por ora;
 * ponderação adiada — mesmo padrão dos pesos de obstáculo). */
export const WEATHER_PICK_CATALOG: readonly WeatherKind[] = WEATHER_KINDS;

/** Modificadores de física por clima. Refs de objeto congelado ⇒ lookup alocação-zero. */
export const WEATHER_PHYSICS: Readonly<Record<WeatherKind, WeatherPhysics>> = Object.freeze({
  clear: Object.freeze({ gravityScale: 1, windY: 0 }),
  rain: Object.freeze({ gravityScale: RAIN_GRAVITY_SCALE, windY: 0 }),
  wind: Object.freeze({ gravityScale: 1, windY: WIND_UPDRAFT }),
  storm: Object.freeze({ gravityScale: STORM_GRAVITY_SCALE, windY: STORM_DOWNDRAFT }),
  snow: Object.freeze({ gravityScale: SNOW_GRAVITY_SCALE, windY: 0 }),
});

/** Física do clima (ref estável do catálogo; não aloca). */
export function weatherPhysics(kind: WeatherKind): WeatherPhysics {
  return WEATHER_PHYSICS[kind];
}
