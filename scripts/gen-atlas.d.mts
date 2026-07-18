export const CELL: number;
export const COLS: number;

export const ATLAS_FRAMES: readonly {
  id: string;
  color: number;
  shape: 'rect' | 'circle' | 'triangle';
}[];

export function renderAtlas(): {
  png: Buffer;
  json: {
    frames: Record<
      string,
      {
        frame: { x: number; y: number; w: number; h: number };
        rotated: boolean;
        trimmed: boolean;
        sourceSize: { w: number; h: number };
        spriteSourceSize: { x: number; y: number; w: number; h: number };
      }
    >;
    meta: Record<string, unknown>;
  };
};
