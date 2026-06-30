/** Interpolação linear. t fora de [0,1] extrapola. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
