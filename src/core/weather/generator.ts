import type { Rng } from '@core/rng';
import type { WeatherConfig, WeatherKind } from './types';
import { WEATHER_PICK_CATALOG } from './catalog';
import { WEATHER_WARMUP_DISTANCE, WEATHER_SEGMENT_MIN, WEATHER_SEGMENT_MAX } from './constants';

/** Config padrão de segmentação (placeholders de tuning). */
export const DEFAULT_WEATHER_CONFIG: WeatherConfig = Object.freeze({
  warmupDistance: WEATHER_WARMUP_DISTANCE,
  segmentMin: WEATHER_SEGMENT_MIN,
  segmentMax: WEATHER_SEGMENT_MAX,
});

/**
 * Sequenciador determinístico de clima, keyed por distância. Consome só o Rng dado; avança
 * um cursor por fronteira de segmento cruzada ⇒ independente de batching/fps (nº de saques =
 * fronteiras cruzadas = f(distância)). Mesma propriedade dos SpawnGenerator.
 */
export class WeatherGenerator {
  private readonly rng: Rng;
  private readonly config: WeatherConfig;
  private currentKind: WeatherKind;
  private nextChangeX: number;

  constructor(rng: Rng, config: WeatherConfig = DEFAULT_WEATHER_CONFIG) {
    this.rng = rng;
    this.config = config;
    this.currentKind = 'clear';
    this.nextChangeX = config.warmupDistance;
  }

  get current(): WeatherKind {
    return this.currentKind;
  }

  /** Avança o cursor até `distance`, atualizando o clima corrente. Monótona quando `distance`
   * não recua; alocação-zero (só escalares + pick/range). */
  advanceTo(distance: number): void {
    while (distance >= this.nextChangeX) {
      this.currentKind = this.rng.pick(WEATHER_PICK_CATALOG);
      this.nextChangeX += this.rng.range(this.config.segmentMin, this.config.segmentMax);
    }
  }

  /** Cópia independente (rng clonado + cursor + kind). Para cloneWorld/snapshots. */
  clone(): WeatherGenerator {
    const c = new WeatherGenerator(this.rng.clone(), this.config);
    c.currentKind = this.currentKind;
    c.nextChangeX = this.nextChangeX;
    return c;
  }
}
