/**
 * Wall-nut source art: dimensional shell texture, three damage
 * appearances with progressive cracks and missing shell fragments,
 * increasingly anxious expressions, and an impact squash clip.
 */
import { blob, eye, frameRng, mouth, outline } from './helpers';
import { INK } from './palette';

export const WALLNUT_W = 60;
export const WALLNUT_H = 64;

export type WallnutTier = 'full' | 'cracked' | 'broken';

export function drawWallnutFrame(ctx: CanvasRenderingContext2D, clip: string, frame: number): void {
  const tier: WallnutTier = clip === 'cracked' || clip === 'broken' ? clip : 'full';
  const squash = clip === 'squash';
  const r = frameRng(9100 + frame * 7 + (tier === 'full' ? 0 : tier === 'cracked' ? 100 : 200));
  const breathe = 1 + Math.sin((frame / 6) * Math.PI * 2) * 0.02;
  const squish = squash ? [0.88, 0.94, 1][Math.min(frame, 2)]! : 1;
  const anxious = tier !== 'full';
  const broken = tier === 'broken';
  const blink = frame === 4 && !anxious;

  ctx.save();
  ctx.translate(0, 4);
  ctx.rotate(-0.03);
  ctx.scale(2 - squish, squish * (1.06 - 0.03));
  ctx.scale(breathe, 1 / breathe);

  // ---- shell body ----
  blob(ctx, 0, -2, 22, 27, '#c98a4b', '#8a5a2c', 2.6);
  // dimensional shell ridges
  ctx.strokeStyle = 'rgba(90,55,25,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -2, 17.5, -0.75, 0.35);
  ctx.arc(0, 2, 13.5, 0.45, 1.25);
  ctx.stroke();
  // painted texture speckle
  ctx.fillStyle = 'rgba(90,55,25,0.28)';
  for (let i = 0; i < 12; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(4, 19);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, -2 + Math.sin(a) * d * 0.82, 0.7 + r.range(0, 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  // top highlight
  ctx.fillStyle = 'rgba(255,235,190,0.5)';
  ctx.beginPath();
  ctx.ellipse(-7, -14, 8.5, 6, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // bottom shade
  ctx.fillStyle = 'rgba(60,35,12,0.25)';
  ctx.beginPath();
  ctx.ellipse(5, 20, 13, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // ---- face (anxiety escalates with damage) ----
  const eyeY = -6;
  const brow = anxious ? (broken ? 2.4 : 1.6) : 0;
  if (blink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10.5, eyeY);
    ctx.lineTo(-3.5, eyeY);
    ctx.moveTo(3.5, eyeY);
    ctx.lineTo(10.5, eyeY);
    ctx.stroke();
  } else {
    eye(ctx, -7, eyeY, 3.4, 1.5, 0, broken ? 1 : anxious ? 0.5 : 0);
    eye(ctx, 7, eyeY, 3.4, 1.5, 0, broken ? 1 : anxious ? 0.5 : 0);
  }
  if (brow > 0) {
    outline(ctx, 1.7, () => {
      ctx.moveTo(-11, eyeY - 5 - brow * 0.4);
      ctx.lineTo(-4.5, eyeY - 3.4);
      ctx.moveTo(11, eyeY - 5 - brow * 0.4);
      ctx.lineTo(4.5, eyeY - 3.4);
    });
  }
  mouth(ctx, 0, broken ? 10 : 3, 6.5, broken, 1.8);

  // ---- damage tiers ----
  if (anxious) {
    ctx.strokeStyle = '#5a3618';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo(-8, 6);
    ctx.lineTo(-12, -2);
    ctx.moveTo(16, -12);
    ctx.lineTo(8, -16);
    ctx.lineTo(10, -22);
    ctx.stroke();
  }
  if (broken) {
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(4, 20);
    ctx.lineTo(0, 10);
    ctx.lineTo(5, 2);
    ctx.moveTo(-14, -16);
    ctx.lineTo(-6, -10);
    ctx.lineTo(-9, -4);
    ctx.moveTo(13, 14);
    ctx.lineTo(9, 7);
    ctx.stroke();
    // large missing shell fragment (dark inner notch)
    ctx.fillStyle = 'rgba(58,34,12,0.9)';
    ctx.beginPath();
    ctx.moveTo(14, -1);
    ctx.lineTo(21, 0);
    ctx.lineTo(19, 8);
    ctx.lineTo(12, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  if (squash) {
    // impact lines
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-16, -16);
    ctx.lineTo(-10, -20);
    ctx.moveTo(16, -14);
    ctx.lineTo(10, -18);
    ctx.stroke();
  }
  ctx.restore();
}
