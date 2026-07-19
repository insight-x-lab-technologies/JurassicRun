export const UI_SOURCES: readonly { out: string; file: string; maxDim: number; opaque?: boolean }[];
export function renderUi(): { out: string; png: Buffer }[];
