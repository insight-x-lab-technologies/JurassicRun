import type { InputFrame } from '@core/sim';

/** Sequência de inputs de um replay headless (um frame por step de simulação). */
export type InputTimeline = readonly InputFrame[];

/** Constrói uma timeline de `length` frames; flap quando `pattern(i)` é true. Determinístico. */
export function buildTimeline(length: number, pattern: (i: number) => boolean): InputTimeline {
  const out: InputFrame[] = new Array<InputFrame>(length);
  for (let i = 0; i < length; i++) out[i] = { flap: pattern(i) };
  return out;
}
