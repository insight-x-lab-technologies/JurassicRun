// Placeholders de tuning do clima (unidades abstratas; +y para baixo). Afinados na Fase 8.

/** Distância inicial garantida 'clear', para um começo calmo. */
export const WEATHER_WARMUP_DISTANCE = 600;
/** Comprimento mínimo de um segmento de clima (distância). */
export const WEATHER_SEGMENT_MIN = 800;
/** Comprimento máximo de um segmento de clima (distância). */
export const WEATHER_SEGMENT_MAX = 1600;

/** Gravidade efetiva sob chuva (asas pesadas/molhadas). */
export const RAIN_GRAVITY_SCALE = 1.15;
/** Empuxo/updraft do vento (unidades/s², negativo = p/ cima). */
export const WIND_UPDRAFT = -120;
/** Gravidade efetiva sob tempestade (pesado). */
export const STORM_GRAVITY_SCALE = 1.25;
/** Downdraft da tempestade (unidades/s², positivo = p/ baixo). */
export const STORM_DOWNDRAFT = 90;
/** Gravidade efetiva sob neve (leve/à deriva). */
export const SNOW_GRAVITY_SCALE = 0.8;
