import type { InputFrame } from '@core/sim';

/** Fonte de input amostrada uma vez por step da simulação. 2.2 adiciona toque/tecla. */
export interface InputSource {
  sample(): InputFrame;
}

/** Fonte nula: nunca pede flap. Usada em 2.1 (input real é 2.2). */
export class NullInputSource implements InputSource {
  sample(): InputFrame {
    return { flap: false };
  }
}
