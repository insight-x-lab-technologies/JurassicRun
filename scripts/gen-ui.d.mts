export const UI_SOURCES: readonly {
  out: string; file: string; maxDim: number; opaque?: boolean;
  grid?: { cols: number; rows: number; names: readonly string[] };
}[];
export function renderUi(): { out: string; png: Buffer }[];
