// Primitivas puras do PRNG mulberry32 e do hash de seed xmur3.
// Determinísticas e portáveis: aritmética uint32 via Math.imul e >>> 0.

/** Incremento do passo mulberry32 (constante do algoritmo). */
export const MULBERRY32_INCREMENT = 0x6d2b79f5;

/**
 * Mistura um estado (já avançado pelo incremento) no valor de saída uint32.
 * Esta é a única fonte de saída do RNG — `Rng` avança o estado e chama isto.
 */
export function scramble(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

/** Hash estável de string → uint32 (xmur3), usado para semear o estado inicial. */
export function xmur3Hash(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}
