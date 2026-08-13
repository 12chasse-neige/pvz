/** Board layout and tuning constants. Logical resolution is 800x600. */

export const GRID = { cols: 9, rows: 5 } as const;
export const CELL_W = 80;
export const CELL_H = 100;
export const LAWN_LEFT = 40;
export const LAWN_TOP = 80;
export const LAWN_W = GRID.cols * CELL_W; // 720
export const LAWN_H = GRID.rows * CELL_H; // 500

export const HOUSE_X = 18; // zombie crossing this line loses the game
export const MOWER_X = 6; // mower rest position
export const MOWER_SPEED = 320;

export const SUN_TTL = 10; // seconds before a sun despawns
export const SUN_COLLECT_RADIUS = 32; // click radius for collecting sun

export const cellCenterX = (col: number): number => LAWN_LEFT + col * CELL_W + CELL_W / 2;
export const cellCenterY = (row: number): number => LAWN_TOP + row * CELL_H + CELL_H / 2;
export const cellLeft = (col: number): number => LAWN_LEFT + col * CELL_W;
export const cellTop = (row: number): number => LAWN_TOP + row * CELL_H;

export interface Cell {
  col: number;
  row: number;
}

export function pixelToCell(x: number, y: number): Cell | null {
  if (x < LAWN_LEFT || x >= LAWN_LEFT + LAWN_W || y < LAWN_TOP || y >= LAWN_TOP + LAWN_H) {
    return null;
  }
  return {
    col: Math.floor((x - LAWN_LEFT) / CELL_W),
    row: Math.floor((y - LAWN_TOP) / CELL_H),
  };
}

/** Column index a zombie at x currently occupies (clamped to the board). */
export function zombieCell(x: number): number {
  return Math.min(GRID.cols - 1, Math.max(0, Math.floor((x - LAWN_LEFT) / CELL_W)));
}
