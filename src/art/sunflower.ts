/**
 * Sunflower source art: layered petals, textured center, asymmetrical
 * leaves, blinking + smiling, gentle breathing, sun-production
 * anticipation and a radiant release. Pivot = ground contact.
 */
import { blob, eye, frameRng, mouth } from './helpers';
import { GREEN_SHADE, INK, LEAF } from './palette';

export const SUNFLOWER_W = 72;
export const SUNFLOWER_H = 80;

export type SunflowerClip = 'idle' | 'produce';

export function drawSunflowerFrame(ctx: CanvasRenderingContext2D, clip: SunflowerClip, frame: number): void {
  const r = frameRng(8800 + frame * 11 + (clip === 'produce' ? 500 : 0));
  const breathe = 1 + Math.sin((frame / 8) * Math.PI * 2) * 0.02;
  const blink = clip === 'idle' && frame === 5;
  const producing = clip === 'produce';
  // produce timeline: 0-2 anticipation (glow builds, lean back), 3 release
  const glow = producing ? [0.15, 0.45, 0.85, 1][Math.min(frame, 3)]! : 0;
  const lean = producing ? [0, -0.04, -0.09, 0.02][Math.min(frame, 3)]! : 0;
  const joy = producing && frame === 3;

  ctx.save();
  ctx.translate(0, 4);
  ctx.rotate(lean + Math.sin((frame / 8) * Math.PI * 2) * 0.03);
  ctx.scale(breathe, 1 / breathe);

  // ---- stem + asymmetrical leaves ----
  ctx.strokeStyle = GREEN_SHADE;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.quadraticCurveTo(-2, 10, -1, 22);
  ctx.stroke();
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  ctx.ellipse(-10, 16, 10, 4.4, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GREEN_SHADE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(11, 20, 7.5, 3.6, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ---- radiant release / production glow ----
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, -10, 4, 0, -10, 34 + glow * 14);
    g.addColorStop(0, 'rgba(255,236,120,' + (0.25 + glow * 0.55).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,236,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -10, 34 + glow * 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- layered petals: outer ring + inner ring ----
  const outer = 12;
  const spin = (frame / 8) * Math.PI * 2 * 0.12;
  for (let i = 0; i < outer; i++) {
    const a = (i / outer) * Math.PI * 2 + spin;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -16.5);
    const wig = 1 + Math.sin((frame / 8) * Math.PI * 2 + i) * 0.04;
    ctx.scale(wig, wig);
    ctx.fillStyle = i % 2 === 0 ? '#ffd23f' : '#f4b92e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.6, 9.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,120,20,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  const inner = 8;
  for (let i = 0; i < inner; i++) {
    const a = (i / inner) * Math.PI * 2 + spin * 1.6;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -9.5);
    ctx.fillStyle = '#e8a92e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.4, 6.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- textured face disk ----
  blob(ctx, 0, -10, 12, 12, '#8b5a2b', '#5f3a1a', 2.2);
  ctx.fillStyle = 'rgba(40,20,8,0.45)';
  for (let i = 0; i < 9; i++) {
    const a = (r.next() * Math.PI * 2);
    const d = r.range(1.5, 8.5);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, -10 + Math.sin(a) * d, 0.8 + r.range(0, 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- expressive face ----
  if (blink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, -12);
    ctx.lineTo(-1, -12);
    ctx.moveTo(1, -12);
    ctx.lineTo(7, -12);
    ctx.stroke();
  } else {
    eye(ctx, -4, -12, 3, 1.4, 0, joy ? -1 : 0);
    eye(ctx, 4, -12, 3, 1.4, 0, joy ? -1 : 0);
  }
  mouth(ctx, 0, -6, 7, false, 1.6);
  if (joy) {
    // open radiant smile
    ctx.fillStyle = '#3a2410';
    ctx.beginPath();
    ctx.ellipse(0, -6, 3.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // blush
  ctx.fillStyle = 'rgba(255,150,120,0.4)';
  ctx.beginPath();
  ctx.ellipse(-8.5, -8, 2.6, 1.8, 0, 0, Math.PI * 2);
  ctx.ellipse(8.5, -8, 2.6, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // release sparks
  if (producing && frame === 3) {
    ctx.fillStyle = 'rgba(255,236,120,0.95)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 22, -10 + Math.sin(a) * 22, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
