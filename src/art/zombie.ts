/**
 * Basic zombie source art. Frames face LEFT (the direction zombies move,
 * toward the house); runtime flips them for menu vignettes. Pivot = ground
 * contact between the feet.
 */
import { blob, frameRng, rr, speckle } from './helpers';
import { INK, Z_PANTS, Z_SHIRT, Z_SHOE, Z_SKIN, Z_SKIN_ACCENT, Z_SKIN_SHADE, Z_TIE } from './palette';

export const ZOMBIE_W = 76;
export const ZOMBIE_H = 100;

export type ZombieClip = 'walk' | 'eat' | 'death';

const TAU = Math.PI * 2;

export function drawBasicZombieFrame(ctx: CanvasRenderingContext2D, clip: ZombieClip, frame: number): void {
  const r = frameRng(2200 + frame * 13 + clip.charCodeAt(0) * 31);
  ctx.save();
  ctx.translate(0, 2);

  if (clip === 'death') {
    drawDeath(ctx, r, frame);
    ctx.restore();
    return;
  }

  const eat = clip === 'eat';
  const phase = (frame / 8) * TAU;
  const bob = eat ? Math.sin((frame / 4) * TAU) * 1.4 : Math.abs(Math.sin(phase)) * -1.8;
  const lean = eat ? 0.22 : 0.1;

  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(lean);

  // ---- legs ----
  for (const side of [-1, 1] as const) {
    const legPhase = eat ? 0.1 * side : phase + (side > 0 ? Math.PI : 0);
    const swing = Math.sin(legPhase) * (eat ? 0.06 : 0.42);
    ctx.save();
    ctx.translate(side * 6, -26);
    ctx.rotate(swing);
    // thigh
    ctx.strokeStyle = Z_PANTS;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 12);
    ctx.stroke();
    // shin
    ctx.rotate(Math.sin(legPhase + 0.7) * (eat ? 0.02 : 0.3));
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(side * 2, 24);
    ctx.stroke();
    // shoe
    ctx.fillStyle = Z_SHOE;
    ctx.beginPath();
    ctx.ellipse(side * 2 + (eat ? 0 : 2), 25, 6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // ---- torso ----
  ctx.fillStyle = Z_SHIRT;
  rr(ctx, -13, -56, 26, 32, 7);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  rr(ctx, -13, -56, 26, 32, 7);
  ctx.stroke();
  // shirt shading + wrinkles
  ctx.fillStyle = 'rgba(20,12,6,0.18)';
  rr(ctx, 1, -50, 12, 26, 6);
  ctx.fill();
  speckle(ctx, r, -11, -54, 22, 26, 8, 'rgba(0,0,0,0.12)', 0.5);
  // tie
  ctx.fillStyle = Z_TIE;
  ctx.save();
  ctx.translate(-1, -52);
  ctx.rotate(Math.sin(phase) * 0.16);
  rr(ctx, -2.4, 0, 4.8, 17, 2);
  ctx.fill();
  ctx.restore();

  // ---- arms (reaching forward while walking, chewing while eating) ----
  ctx.strokeStyle = Z_SKIN;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const side of [-1, 1] as const) {
    const swing = eat ? Math.sin((frame / 4) * TAU + side) * 0.12 : Math.sin(phase + side) * 0.3;
    ctx.save();
    ctx.translate(side * 4, -46);
    ctx.rotate(-0.9 + swing * (side > 0 ? -1 : 1));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, eat ? 12 : 16);
    ctx.stroke();
    // hand
    ctx.fillStyle = Z_SKIN_SHADE;
    ctx.beginPath();
    ctx.arc(0, eat ? 13 : 17, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (eat) {
    // hands near the mouth
    ctx.fillStyle = Z_SKIN_SHADE;
    ctx.beginPath();
    ctx.arc(-13, -46, 4, 0, TAU);
    ctx.arc(-8, -48, 4, 0, TAU);
    ctx.fill();
  }

  // ---- head ----
  const hx = -7;
  const hy = -66;
  blob(ctx, hx, hy, 12, 11.5, Z_SKIN, Z_SKIN_SHADE, 2.4);
  // sunken cheek
  ctx.fillStyle = 'rgba(60,70,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(hx + 3, hy + 3, 4.5, 3.4, 0, 0, TAU);
  ctx.fill();

  // dangling jaw
  const jawOpen = eat ? (frame === 0 || frame === 2 ? 0.5 : 0.15) : 0.3 + Math.sin(phase * 2) * 0.08;
  ctx.save();
  ctx.translate(hx - 3, hy + 6);
  ctx.rotate(jawOpen * 0.5);
  blob(ctx, 0, 2, 5.4, 4.2, Z_SKIN_ACCENT, Z_SKIN_SHADE, 2);
  // teeth
  ctx.fillStyle = '#e8e4d0';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(-4 + i * 3, -1.6 - jawOpen * 1.5, 2.2, 2.6);
  }
  ctx.restore();

  // eyes (sunken, tired)
  for (const ex of [hx - 6, hx + 2] as const) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, hy - 4, 2.6, 2.9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = '#241a12';
    ctx.beginPath();
    ctx.arc(ex - 0.8, hy - 3.4, 1.1, 0, TAU);
    ctx.fill();
  }
  // heavy brows
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(hx - 9, hy - 9);
  ctx.lineTo(hx - 3.4, hy - 7.4);
  ctx.moveTo(hx - 0.6, hy - 7.6);
  ctx.lineTo(hx + 5, hy - 9.2);
  ctx.stroke();

  // messy hair
  ctx.fillStyle = '#4a4030';
  ctx.beginPath();
  ctx.ellipse(hx - 1, hy - 11, 9, 3.6, -0.2, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

/** Staged defeat: buckle → lean back → fall → flat on the ground. */
function drawDeath(ctx: CanvasRenderingContext2D, r: ReturnType<typeof frameRng>, frame: number): void {
  const stages = [
    { drop: 0, rot: 0.1, arm: 0.4, y: 0 },
    { drop: -6, rot: -0.24, arm: -1.2, y: -4 },
    { drop: -22, rot: -1.25, arm: -2.4, y: -10 },
    { drop: -30, rot: -1.5, arm: -2.8, y: -6 },
  ];
  const s = stages[Math.min(frame, 3)]!;
  ctx.save();
  ctx.translate(0, s.y + 26);
  ctx.rotate(s.rot);
  ctx.translate(0, s.drop);

  // legs crumpled
  ctx.strokeStyle = Z_PANTS;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -26);
  ctx.lineTo(-12, -14);
  ctx.moveTo(4, -26);
  ctx.lineTo(12, -14);
  ctx.stroke();
  ctx.fillStyle = Z_SHOE;
  ctx.beginPath();
  ctx.ellipse(-12, -12, 6, 3.4, 0.5, 0, TAU);
  ctx.ellipse(12, -12, 6, 3.4, -0.5, 0, TAU);
  ctx.fill();

  // torso
  ctx.fillStyle = Z_SHIRT;
  rr(ctx, -13, -56, 26, 32, 7);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  rr(ctx, -13, -56, 26, 32, 7);
  ctx.stroke();

  // arms thrown up/back
  ctx.strokeStyle = Z_SKIN;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-10, -50);
  ctx.lineTo(-22, -62 + s.arm * 6);
  ctx.moveTo(8, -50);
  ctx.lineTo(18, -64 + s.arm * 6);
  ctx.stroke();

  // head lolling back
  ctx.save();
  ctx.translate(-7, -64);
  ctx.rotate(0.5 - frame * 0.12);
  blob(ctx, 0, -4, 12, 11.5, Z_SKIN, Z_SKIN_SHADE, 2.4);
  blob(ctx, -3, 4, 5.4, 4.2, Z_SKIN_ACCENT, Z_SKIN_SHADE, 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-5, -7, 2.4, 2.7, 0, 0, TAU);
  ctx.ellipse(3, -7, 2.4, 2.7, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // dust speckles at impact
  if (frame >= 2) speckle(ctx, r, -26, -14, 52, 12, 14, 'rgba(120,110,80,0.5)', 0.7);

  ctx.restore();
}
