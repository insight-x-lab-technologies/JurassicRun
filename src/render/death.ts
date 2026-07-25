/**
 * Curvas puras da animação de morte (9.3): giro/queda/shake/flash em função do tempo
 * REAL decorrido (não de steps — a sim já congela em `dead`). Puramente cosmético ⇒ não
 * toca `src/core/`. Alocação-zero: `deathVisual` escreve em `out` e devolve o mesmo objeto
 * (scratch reusável no hot path do render — REGRA 3).
 */

/** Duração total da fase cosmética `dying`, em segundos. */
export const DEATH_ANIM_SECONDS = 0.75;

const TURNS = 1.25; // voltas totais de giro
const SHAKE_AMP = 1.6; // amplitude inicial do tremor (unidades de mundo)
const SHAKE_FREQ_X = 18; // Hz
const SHAKE_FREQ_Y = 23.4; // Hz (fora de fase de X ⇒ tremor não circular)
const FLASH_SECONDS = 0.12;

export interface DeathVisual {
  /** 0..1 — elapsed / DEATH_ANIM_SECONDS, clampado. */
  progress: number;
  /** rad — giro acelerado (~TURNS voltas no total). */
  rotation: number;
  /** −0,04..1 — pop para cima no impacto, depois queda acelerada; cruza 0 em p=1/3, vale 1 em p=1. */
  dropFactor: number;
  /** unidades de mundo — oscilação amortecida (0 quando p>=1). */
  shakeX: number;
  shakeY: number;
  /** 1→0 nos primeiros 0,12s (tint de impacto). */
  flash: number;
}

/** Estado visual da morte no instante `elapsed` (segundos desde a transição para `dead`).
 *  Muta e devolve `out` — sem alocação. */
export function deathVisual(elapsed: number, out: DeathVisual): DeathVisual {
  const p = Math.min(1, Math.max(0, elapsed / DEATH_ANIM_SECONDS));
  const amp = SHAKE_AMP * (1 - p) * (1 - p);

  out.progress = p;
  out.rotation = 2 * Math.PI * TURNS * p * p;
  out.dropFactor = -0.5 * p + 1.5 * p * p;
  // `+ 0` normaliza -0→0 (amp=0 em p>=1 × cos/sin negativo pode gerar -0; queremos 0 exato).
  out.shakeX = amp * Math.cos(2 * Math.PI * SHAKE_FREQ_X * elapsed) + 0;
  out.shakeY = 0.6 * amp * Math.sin(2 * Math.PI * SHAKE_FREQ_Y * elapsed) + 0;
  out.flash = Math.min(1, Math.max(0, 1 - elapsed / FLASH_SECONDS));
  return out;
}
