export const ATLAS_KEY: string;
export const ATLAS_SOURCES: readonly { id: string; file: string; frames: number }[];
export function renderAtlas(): {
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
