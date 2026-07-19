export const UI_SOURCES: readonly {
  out: string; file: string; maxDim: number; opaque?: boolean;
  grid?: { cols: number; rows: number; names: readonly string[] };
  regions?: readonly { name: string; x: number; y: number; w: number; h: number; opaque?: boolean }[];
}[];
export function renderUi(): { out: string; png: Buffer }[];
