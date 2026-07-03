// Placeholders de tuning (unidades abstratas; +y para baixo). Afinados em fase posterior.

/** Duração da invulnerabilidade do escudo (steps). ~5 s a 60 fps. */
export const SHIELD_DURATION_STEPS = 300;
/** Duração do ímã (steps). ~6 s. */
export const MAGNET_DURATION_STEPS = 360;
/** Duração da moeda-dobrada (steps). ~8 s. */
export const DOUBLE_COIN_DURATION_STEPS = 480;
/** Escudo curto concedido ao reviver com vida extra (steps). ~1 s. */
export const EXTRA_LIFE_GRACE_STEPS = 60;

/** Raio (unidades) dentro do qual o ímã atrai coletáveis. */
export const MAGNET_RADIUS = 60;
/** Velocidade de atração do ímã (unidades/s). */
export const MAGNET_PULL_SPEED = 220;

/** Comida ganha por pássaro-moeda enquanto a moeda-dobrada está ativa (vs 1 normal). */
export const DOUBLE_COIN_FOOD_GAIN = 2;
