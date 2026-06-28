import { MULBERRY32_INCREMENT, scramble, xmur3Hash } from './mulberry32';

const UINT32 = 0x1_0000_0000; // 2^32

export interface Rng {
  readonly seed: string;
  readonly state: number;
  nextUint32(): number;
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(array: readonly T[]): T;
  fork(streamId: string | number): Rng;
  clone(): Rng;
}

/** Hash estável de uma seed (string|number) → estado inicial uint32. */
export function hashSeed(seed: string | number): number {
  return xmur3Hash(String(seed));
}

class Mulberry32Rng implements Rng {
  readonly seed: string;
  private _state: number;

  constructor(seed: string, state: number) {
    this.seed = seed;
    this._state = state | 0;
  }

  get state(): number {
    return this._state >>> 0;
  }

  nextUint32(): number {
    this._state = (this._state + MULBERRY32_INCREMENT) | 0;
    return scramble(this._state);
  }

  next(): number {
    return this.nextUint32() / UINT32;
  }

  range(_min: number, _max: number): number {
    throw new Error('not implemented'); // Task 3
  }

  int(_min: number, _max: number): number {
    throw new Error('not implemented'); // Task 3
  }

  pick<T>(_array: readonly T[]): T {
    throw new Error('not implemented'); // Task 3
  }

  fork(_streamId: string | number): Rng {
    throw new Error('not implemented'); // Task 4
  }

  clone(): Rng {
    return new Mulberry32Rng(this.seed, this._state);
  }
}

/** Cria um RNG a partir de uma seed estável. */
export function createRng(seed: string | number): Rng {
  const normalized = String(seed);
  return new Mulberry32Rng(normalized, hashSeed(normalized));
}

/** Reconstrói um RNG a partir de um estado uint32 salvo (replay/golden master). */
export function rngFromState(seed: string | number, state: number): Rng {
  return new Mulberry32Rng(String(seed), state | 0);
}

export { Mulberry32Rng };
