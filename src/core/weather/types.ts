/** Condição climática ativa (afeta a física vertical). */
export type WeatherKind = 'clear' | 'rain' | 'wind' | 'storm' | 'snow';

/** Modificadores de física vertical de um clima (dados puros; +y para baixo). */
export interface WeatherPhysics {
  /** Multiplica a gravidade efetiva do step. clear = 1. */
  gravityScale: number;
  /** Aceleração vertical constante adicional (unidades/s²). clear = 0.
   * Negativo = empuxo/updraft (sobe); positivo = downdraft (empurra p/ baixo). */
  windY: number;
}

/** Parâmetros de segmentação do WeatherGenerator (dados puros). */
export interface WeatherConfig {
  /** Distância inicial garantida sem clima ('clear'). */
  readonly warmupDistance: number;
  /** Comprimento mínimo de um segmento de clima (distância). */
  readonly segmentMin: number;
  /** Comprimento máximo de um segmento de clima (distância). */
  readonly segmentMax: number;
}
