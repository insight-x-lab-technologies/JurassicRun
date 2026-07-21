export interface AtlasGrid { cols: number; rows: number; names: readonly (string | null)[]; }
export interface AtlasSource {
  id: string;
  file: string;
  frames?: number;
  root?: string;
  chroma?: boolean;
  grid?: AtlasGrid;
}
export const ATLAS_KEY: string;
export const ATLAS_SOURCES: readonly AtlasSource[];
export const ATLAS_VARIANTS: readonly { key: string; sources: readonly AtlasSource[] }[];
export function renderAtlas(sources?: readonly AtlasSource[]): {
  png: Buffer;
  json: {
    frames: Record<string, {
      frame: { x: number; y: number; w: number; h: number };
      rotated: boolean; trimmed: boolean;
      sourceSize: { w: number; h: number };
      spriteSourceSize: { x: number; y: number; w: number; h: number };
    }>;
    meta: Record<string, unknown>;
  };
};

export interface DecodedPng { w: number; h: number; rgba: Buffer; }
export function decodePng(buf: Buffer): DecodedPng;
export function contentBounds(img: DecodedPng, x0: number, y0: number, x1: number, y1: number): { minX: number; minY: number; maxX: number; maxY: number };
export function cropResize(img: DecodedPng, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number): Buffer;
export function chromaKeyToAlpha(img: { w: number; h: number; rgba: Buffer }, opts?: { inner?: number; outer?: number }): { w: number; h: number; rgba: Buffer };
