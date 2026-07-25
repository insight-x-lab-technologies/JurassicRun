export const SEG_CELL_W: number;
export const SEG_CELL_H: number;
export const SEG_THEMES: {
  classic: { 'obstacle.tree': { cap: number[]; body: number[]; base: number[] }; 'obstacle.vine': { cap: number[]; body: number[]; base: number[] } };
  volcano: { 'obstacle.tree': { cap: number[]; body: number[]; base: number[] }; 'obstacle.vine': { cap: number[]; body: number[]; base: number[] } };
  glacier: { 'obstacle.tree': { cap: number[]; body: number[]; base: number[] }; 'obstacle.vine': { cap: number[]; body: number[]; base: number[] } };
};
export function renderSegmentStrip(parts: { cap: number[]; body: number[]; base: number[] }): Buffer;
