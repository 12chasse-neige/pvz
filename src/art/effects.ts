/**
 * Effect + prop source art: peas, sun, lawn mower, explosion flash.
 */
import { blob, frameRng, rr, speckle } from './helpers';
import { BLAST, BLAST_CORE, BLAST_RIM, INK, PEA, PEA_FROZEN, PEA_FROZEN_RIM, PEA_RIM, SMOKE, SUN, SUN_RIM } from './palette';

export const PEA_W = 26;
export const PEA_H = 26;
export const SUN_W = 48;
export const SUN_H = 48;
export const MOWER_W = 68;
export const MOWER_H = 44;
export const BLAST_W = 96;
export const BLAST_H = 96;

/** Pea projectile: 3 spin frames. */
export function drawPeaFrame(ctx: CanvasRenderingContext2D, frame: number, frozen: boolean): void {
  const body = frozen ? PEA_FROZEN : PEA;
  const rim = frozen ? PEA_FROZEN_RIM : PEA_RIM;
  const spin = (frame / 3) * Math.PI;
  ctx.save();
  ctx.rotate(spin);
  blob(ctx, 0, 0, 7, 7, body, rim, 1.8);
  // spin streak line
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(4, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-2, -2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  if (frozen) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(8, 8);
    ctx.moveTo(-4, 4);
    ctx.lineTo(-8, 8);
    ctx.moveTo(4, -4);
    ctx.lineTo(8, -8);
    ctx.stroke();
  }
  ctx.restore();
}

/** Sun pickup: 3 pulse frames with a friendly face. */
export function drawSunFrame(ctx: CanvasRenderingContext2D, frame: number): void {
  const pulse = 1 + [0.06, 0, -0.04][frame % 3]!;
  ctx.save();
  ctx.scale(pulse, pulse);
  // glow
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 24);
  g.addColorStop(0, 'rgba(255,230,100,0.8)');
  g.addColorStop(1, 'rgba(255,230,100,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  // rays
  ctx.strokeStyle = SUN;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    ctx.stroke();
  }
  blob(ctx, 0, 0, 11.5, 11.5, SUN, SUN_RIM, 1.8);
  // face
  ctx.fillStyle = '#7a4e1e';
  ctx.beginPath();
  ctx.arc(-3.4, -2, 1.7, 0, Math.PI * 2);
  ctx.arc(3.4, -2, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4e1e';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0.5, 4, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

/** Lawn mower: idle (frame 0) and running (frames 1-4, blade + wheel spin). */
export function drawMowerFrame(ctx: CanvasRenderingContext2D, frame: number): void {
  const running = frame > 0;
  ctx.save();
  // body
  ctx.fillStyle = '#8a8f96';
  rr(ctx, -26, -13, 52, 23, 6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  rr(ctx, -26, -13, 52, 23, 6);
  ctx.stroke();
  // red cowl
  ctx.fillStyle = '#b04a3a';
  rr(ctx, -26, -13, 16, 23, 6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  rr(ctx, -26, -13, 16, 23, 6);
  ctx.stroke();
  // handle
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(22, -6);
  ctx.lineTo(30, -22);
  ctx.stroke();
  // engine top
  ctx.fillStyle = '#b0b6bc';
  rr(ctx, -12, -9, 20, 5, 2);
  ctx.fill();
  // wheels (spin while running)
  for (const wx of [-13, 13] as const) {
    ctx.fillStyle = '#3a3f46';
    ctx.beginPath();
    ctx.arc(wx, 13, 8.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    const spokeA = running ? ((frame - 1) / 4) * Math.PI * 2 : 0;
    ctx.strokeStyle = '#7a7f86';
    ctx.lineWidth = 2;
    for (let s = 0; s < 3; s++) {
      const a = spokeA + (s / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx, 13);
      ctx.lineTo(wx + Math.cos(a) * 6, 13 + Math.sin(a) * 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#9aa0a6';
    ctx.beginPath();
    ctx.arc(wx, 13, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // spinning blade under the front
  if (running) {
    const a = ((frame - 1) / 4) * Math.PI * 2;
    ctx.strokeStyle = '#d8dce0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, 12);
    ctx.lineTo(-30 + Math.cos(a) * 10, 12 + Math.sin(a) * 10);
    ctx.stroke();
  }
  ctx.restore();
}

/** Explosion flash: expanding white-hot ball with ember rim (frame 0..3). */
export function drawBlastFrame(ctx: CanvasRenderingContext2D, frame: number): void {
  const f = [0.35, 0.7, 1, 1.25][Math.min(frame, 3)]!;
  ctx.save();
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46 * f);
  g.addColorStop(0, BLAST_CORE);
  g.addColorStop(0.45, BLAST);
  g.addColorStop(0.8, BLAST_RIM);
  g.addColorStop(1, 'rgba(255,136,68,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 46 * f, 0, Math.PI * 2);
  ctx.fill();
  // jagged embers
  const r = frameRng(3300 + frame);
  ctx.fillStyle = 'rgba(255,150,60,0.9)';
  for (let i = 0; i < 10; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(20, 44) * f;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r.range(2, 4.5), 0, Math.PI * 2);
    ctx.fill();
  }
  if (frame >= 2) {
    speckle(ctx, r, -40, -40, 80, 80, 8, SMOKE, 0.35, 5, 10);
  }
  ctx.restore();
}
