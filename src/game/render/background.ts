import { CELL_H, CELL_W, GRID, LAWN_H, LAWN_LEFT, LAWN_TOP, LAWN_W } from '../config';

/** Pre-rendered static board (sky, house, checkerboard lawn). */
export function createBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 600;
  const ctx = c.getContext('2d')!;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#8ecfef');
  sky.addColorStop(1, '#d8f0e8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 800, 600);

  // Soft sky sun
  const glow = ctx.createRadialGradient(690, 70, 10, 690, 70, 130);
  glow.addColorStop(0, 'rgba(255, 248, 200, 0.95)');
  glow.addColorStop(1, 'rgba(255, 248, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(560, -60, 260, 260);

  // Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const [cx, cy, s] of [[150, 40, 1], [420, 24, 0.8], [600, 52, 0.7]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, 16 * s, 0, Math.PI * 2);
    ctx.arc(cx + 18 * s, cy + 4 * s, 13 * s, 0, Math.PI * 2);
    ctx.arc(cx - 18 * s, cy + 5 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // House strip on the left
  ctx.fillStyle = '#e0cfa0';
  ctx.fillRect(0, LAWN_TOP, LAWN_LEFT, 600 - LAWN_TOP);
  ctx.fillStyle = '#c9b586';
  for (let y = LAWN_TOP + 8; y < 590; y += 22) ctx.fillRect(2, y, LAWN_LEFT - 4, 2);
  // Roof edge
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(0, LAWN_TOP - 6, LAWN_LEFT, 10);
  // Door
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(6, 470, 26, 110);
  ctx.fillStyle = '#5c4228';
  ctx.fillRect(11, 475, 16, 105);
  ctx.fillStyle = '#e8c860';
  ctx.fillRect(20, 530, 3, 3);
  // Window
  ctx.fillStyle = '#9cc8e8';
  ctx.fillRect(8, 130, 24, 30);
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 130, 24, 30);

  // Lawn base
  ctx.fillStyle = '#6fae4e';
  ctx.fillRect(LAWN_LEFT, LAWN_TOP, LAWN_W, LAWN_H);
  for (let col = 0; col < GRID.cols; col++) {
    for (let row = 0; row < GRID.rows; row++) {
      if ((col + row) % 2 === 0) {
        ctx.fillStyle = '#7ec850';
        ctx.fillRect(LAWN_LEFT + col * CELL_W, LAWN_TOP + row * CELL_H, CELL_W, CELL_H);
      }
    }
  }
  // Faint grid lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1;
  for (let col = 0; col <= GRID.cols; col++) {
    ctx.beginPath();
    ctx.moveTo(LAWN_LEFT + col * CELL_W, LAWN_TOP);
    ctx.lineTo(LAWN_LEFT + col * CELL_W, LAWN_TOP + LAWN_H);
    ctx.stroke();
  }
  for (let row = 0; row <= GRID.rows; row++) {
    ctx.beginPath();
    ctx.moveTo(LAWN_LEFT, LAWN_TOP + row * CELL_H);
    ctx.lineTo(LAWN_LEFT + LAWN_W, LAWN_TOP + row * CELL_H);
    ctx.stroke();
  }

  // Right sidewalk
  ctx.fillStyle = '#c8c0b0';
  ctx.fillRect(760, LAWN_TOP, 40, 600 - LAWN_TOP);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(796, LAWN_TOP, 4, 600 - LAWN_TOP);

  // Bottom dirt strip
  ctx.fillStyle = '#9c7a52';
  ctx.fillRect(LAWN_LEFT, LAWN_TOP + LAWN_H, LAWN_W, 20);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.fillRect(LAWN_LEFT, LAWN_TOP + LAWN_H, LAWN_W, 3);
  ctx.fillStyle = '#6fae4e';
  for (let col = 0; col < GRID.cols; col += 2) {
    const x = LAWN_LEFT + col * CELL_W + 18;
    ctx.beginPath();
    ctx.ellipse(x, LAWN_TOP + LAWN_H + 6, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}
