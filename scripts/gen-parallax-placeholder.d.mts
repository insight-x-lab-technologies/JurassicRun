export interface ParallaxPlaceholderSpec {
  theme: string;
  layer: string;
  w: number;
  h: number;
  file: string;
}
export const PARALLAX_PLACEHOLDER_SPECS: readonly ParallaxPlaceholderSpec[];
export function renderPlaceholder(theme: string, layer: string): { w: number; h: number; pixels: Buffer };
