/**
 * Painted environment layers (source art). All functions draw in LOGICAL
 * 800×600 space; the bake script wraps them at 2×, and the runtime
 * fallback uses them at 1×. Layout constants match src/game/config.ts.
 */
import { LAWN_H, LAWN_LEFT, LAWN_TOP, LAWN_W } from '../game/config';
import { blob, frameRng, lighten, rr, speckle } from './helpers';
import {
  CLOUD,
  CLOUD_SHADE,
  DOOR,
  FENCE,
  FENCE_SHADE,
  GRASS,
  GRASS_DARK,
  GRASS_LIGHT,
  HOUSE_ROOF,
  HOUSE_SIDING,
  HOUSE_TRIM,
  INK_SOFT,
  SIDEWALK,
  SKY_HORIZON,
  SKY_TOP,
  SOIL,
  STONE,
  WINDOW_GLASS,
} from './palette';

export const LOGICAL_W = 800;
export const LOGICAL_H = 600;

/** Layer 1: sky gradient, sun glow, far painted clouds. */
export function drawSky(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.65, '#c9e6d8');
  sky.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Warm afternoon sun glow, upper right.
  const glow = ctx.createRadialGradient(690, 70, 8, 690, 70, 150);
  glow.addColorStop(0, 'rgba(255,246,190,0.95)');
  glow.addColorStop(0.35, 'rgba(255,238,160,0.5)');
  glow.addColorStop(1, 'rgba(255,238,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(520, -80, 340, 320);

  // Distant haze band above the lawn.
  const haze = ctx.createLinearGradient(0, 60, 0, 90);
  haze.addColorStop(0, 'rgba(255,244,200,0)');
  haze.addColorStop(1, 'rgba(255,244,200,0.55)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 60, LOGICAL_W, 30);
}

/** Layer 2: drifting parallax clouds. `t` = drift phase (seconds). */
export function drawClouds(ctx: CanvasRenderingContext2D, t: number): void {
  const specs: [number, number, number, number][] = [
    // x, y, scale, speed
    [120, 34, 1.0, 3],
    [330, 16, 0.8, 5],
    [560, 42, 0.65, 4],
    [40, 60, 0.5, 2],
  ];
  for (const [bx, by, s, speed] of specs) {
    const x = ((bx + t * speed) % (LOGICAL_W + 260)) - 130;
    drawCloudCluster(ctx, x, by, s);
  }
}

function drawCloudCluster(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = CLOUD;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.arc(19, 4, 14, 0, Math.PI * 2);
  ctx.arc(-19, 6, 12, 0, Math.PI * 2);
  ctx.arc(8, -8, 12, 0, Math.PI * 2);
  ctx.fill();
  // warm underside
  ctx.fillStyle = CLOUD_SHADE;
  ctx.beginPath();
  ctx.arc(0, 9, 15, Math.PI * 0.1, Math.PI * 0.9);
  ctx.arc(19, 10, 12, Math.PI * 0.1, Math.PI * 0.9);
  ctx.arc(-19, 11, 10, Math.PI * 0.1, Math.PI * 0.9);
  ctx.fill();
  ctx.restore();
}

/** Layer 3: house façade + porch + fence + sidewalk. */
export function drawHouse(ctx: CanvasRenderingContext2D): void {
  // ---- house strip (x < LAWN_LEFT) ----
  const top = LAWN_TOP - 8;
  const h = LOGICAL_H - top;
  ctx.fillStyle = HOUSE_SIDING;
  ctx.fillRect(0, top, LAWN_LEFT, h);
  // vertical planks
  ctx.fillStyle = 'rgba(90,70,40,0.16)';
  for (let x = 9; x < LAWN_LEFT; x += 11) ctx.fillRect(x, top, 1.5, h);
  // siding speckle
  const r1 = frameRng(101);
  speckle(ctx, r1, 0, top, LAWN_LEFT, h, 160, 'rgba(120,90,50,0.10)', 0.5);

  // roof edge / gutter
  ctx.fillStyle = HOUSE_ROOF;
  rr(ctx, -4, top - 2, LAWN_LEFT + 8, 12, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, top + 10, LAWN_LEFT, 2);

  // windows (warm afternoon glass + trim + curtain)
  for (const wy of [150, 300]) {
    ctx.fillStyle = HOUSE_TRIM;
    rr(ctx, 6, wy, 26, 34, 3);
    ctx.fill();
    ctx.fillStyle = WINDOW_GLASS;
    rr(ctx, 10, wy + 4, 18, 26, 2);
    ctx.fill();
    const gl = ctx.createLinearGradient(10, wy + 4, 28, wy + 30);
    gl.addColorStop(0, 'rgba(255,255,255,0.5)');
    gl.addColorStop(1, 'rgba(200,150,60,0.25)');
    ctx.fillStyle = gl;
    rr(ctx, 10, wy + 4, 18, 26, 2);
    ctx.fill();
    ctx.strokeStyle = INK_SOFT;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(19, wy + 4);
    ctx.lineTo(19, wy + 30);
    ctx.moveTo(10, wy + 17);
    ctx.lineTo(28, wy + 17);
    ctx.stroke();
  }

  // door facing the lawn
  ctx.fillStyle = DOOR;
  rr(ctx, 6, 462, 26, 118, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  rr(ctx, 10, 468, 18, 42, 2);
  ctx.fill();
  rr(ctx, 10, 516, 18, 34, 2);
  ctx.fill();
  ctx.fillStyle = '#e8c860';
  ctx.beginPath();
  ctx.arc(29, 528, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 1.5;
  rr(ctx, 6, 462, 26, 118, 3);
  ctx.stroke();

  // porch edge where lawn meets the house
  ctx.fillStyle = HOUSE_TRIM;
  ctx.fillRect(LAWN_LEFT - 3, top, 5, h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(LAWN_LEFT, top, 4, h);

  // short fence along the lawn side
  const fy = LAWN_TOP - 2;
  for (let x = 26; x < LAWN_LEFT - 2; x += 7) {
    ctx.fillStyle = FENCE;
    rr(ctx, x, fy - 22, 4, 24, 1.5);
    ctx.fill();
    ctx.fillStyle = FENCE_SHADE;
    ctx.fillRect(x + 3, fy - 22, 1.2, 24);
  }
  ctx.fillStyle = FENCE;
  rr(ctx, 24, fy - 6, LAWN_LEFT - 26, 4, 2);
  ctx.fill();

  // small planter bush at the porch base
  blob(ctx, 18, 588, 16, 13, GRASS, GRASS_DARK, 2.4);
  blob(ctx, 30, 592, 11, 10, GRASS_LIGHT, GRASS, 2.4);

  // ---- right sidewalk ----
  const sx = LAWN_LEFT + LAWN_W;
  ctx.fillStyle = SIDEWALK;
  ctx.fillRect(sx, LAWN_TOP, LOGICAL_W - sx, LAWN_H);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (const sy of [LAWN_TOP + 125, LAWN_TOP + 260, LAWN_TOP + 395]) {
    ctx.fillRect(sx, sy, LOGICAL_W - sx, 2);
  }
  const r2 = frameRng(202);
  speckle(ctx, r2, sx, LAWN_TOP, LOGICAL_W - sx, LAWN_H, 90, 'rgba(0,0,0,0.07)', 0.5);
  // curb shadow toward the lawn
  const curb = ctx.createLinearGradient(sx - 8, 0, sx, 0);
  curb.addColorStop(0, 'rgba(0,0,0,0)');
  curb.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = curb;
  ctx.fillRect(sx - 8, LAWN_TOP, 8, LAWN_H);
}

/** Layer 4: the lawn itself — mowing stripes + soil border + details. */
export function drawLawn(ctx: CanvasRenderingContext2D): void {
  const x = LAWN_LEFT;
  const y = LAWN_TOP;
  const w = LAWN_W;
  const h = LAWN_H;

  ctx.fillStyle = GRASS;
  ctx.fillRect(x, y, w, h);

  // Mowing stripes per column (subtle — the grid reads, not shouts).
  for (let col = 0; col < 9; col++) {
    ctx.fillStyle = col % 2 === 0 ? GRASS_LIGHT : GRASS_DARK;
    ctx.globalAlpha = 0.34;
    ctx.fillRect(x + col * 80, y, 80, h);
    ctx.globalAlpha = 1;
  }
  // Soft row boundaries.
  ctx.fillStyle = 'rgba(20,60,20,0.10)';
  for (let row = 1; row < 5; row++) ctx.fillRect(x, y + row * 100 - 1, w, 2);

  // Grass texture.
  const r = frameRng(303);
  speckle(ctx, r, x, y, w, h, 900, 'rgba(30,80,25,0.10)', 0.5, 0.6, 1.4);
  speckle(ctx, r, x, y, w, h, 500, 'rgba(180,230,120,0.10)', 0.5, 0.6, 1.6);

  // Faint planting highlights at cell centers.
  ctx.fillStyle = 'rgba(220,255,170,0.10)';
  for (let col = 0; col < 9; col++) {
    for (let row = 0; row < 5; row++) {
      ctx.beginPath();
      ctx.ellipse(x + col * 80 + 40, y + row * 100 + 52, 30, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Soil border strip at the bottom edge.
  const sy = y + h - 16;
  ctx.fillStyle = SOIL;
  ctx.fillRect(x, sy, w, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(x, sy, w, 2.5);
  const r2 = frameRng(404);
  speckle(ctx, r2, x, sy, w, 14, 260, 'rgba(40,25,10,0.25)', 0.5, 0.7, 1.8);

  // Stones + weeds along the soil edge (avoid cell centers).
  const r3 = frameRng(505);
  for (let i = 0; i < 14; i++) {
    const px = x + 12 + r3.range(0, w - 24);
    const py = y + r3.range(30, h - 34);
    if (r3.chance(0.5)) {
      // stone
      ctx.fillStyle = STONE;
      ctx.beginPath();
      ctx.ellipse(px, py, 4 + r3.range(0, 2), 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,60,60,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // weed tuft
      ctx.strokeStyle = lighten(GRASS, 0.18);
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let b = -1; b <= 1; b++) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + b * 2, py - 4, px + b * 4, py - 7);
        ctx.stroke();
      }
    }
  }

  // A few low flower accents for the storybook feel.
  const r4 = frameRng(606);
  for (let i = 0; i < 6; i++) {
    const px = x + 20 + r4.range(0, w - 40);
    const py = y + 18 + r4.range(0, 60);
    ctx.fillStyle = i % 2 === 0 ? '#ffd84d' : '#ff9d5c';
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * 3, py + Math.sin(a) * 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // soft house-side shade
  const shade = ctx.createLinearGradient(x, 0, x + 26, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.16)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, 26, h);
}

/** Layer 7: foreground foliage corners (painted, slightly soft). */
export function drawFoliage(ctx: CanvasRenderingContext2D): void {
  // Bottom-right corner: friendly bush with blossoms.
  const r = frameRng(707);
  ctx.save();
  blob(ctx, 780, 596, 46, 30, GRASS_DARK, GRASS_SHADE_DEEP, 3);
  blob(ctx, 748, 606, 30, 22, GRASS, GRASS_DARK, 3);
  blob(ctx, 798, 586, 26, 20, GRASS_LIGHT, GRASS, 3);
  for (let i = 0; i < 5; i++) {
    const bx = 728 + r.range(0, 72);
    const by = 566 + r.range(0, 30);
    ctx.fillStyle = i % 2 === 0 ? '#ff8fa0' : '#ffd84d';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(bx + Math.cos(a) * 4, by + Math.sin(a) * 4, 3, 2.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bottom-left corner: tulip heads peeking in.
  ctx.fillStyle = GRASS_SHADE_DEEP;
  for (const [bx, by, s] of [[10, 600, 1], [34, 602, 0.8]] as const) {
    ctx.beginPath();
    ctx.ellipse(bx, by, 16 * s, 7 * s, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#e85a6a';
  ctx.beginPath();
  ctx.ellipse(8, 586, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd84d';
  ctx.beginPath();
  ctx.ellipse(30, 590, 4.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const GRASS_SHADE_DEEP = '#3d7a2c';
