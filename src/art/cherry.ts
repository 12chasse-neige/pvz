/**
 * Cherry Bomb source art: two distinct personalities, twitching fuse,
 * accelerating glow, swelling anticipation and a white-hot pre-flash.
 */
import { blob, eye, frameRng, mouth } from './helpers';
import { GREEN_SHADE, INK, LEAF } from './palette';

export const CHERRY_W = 64;
export const CHERRY_H = 60;

export type CherryClip = 'idle' | 'urgent' | 'preflash';

export function drawCherryFrame(ctx: CanvasRenderingContext2D, clip: CherryClip, frame: number): void {
  const r = frameRng(9500 + frame * 5 + clip.charCodeAt(0) * 31);
  const urgent = clip !== 'idle';
  const pre = clip === 'preflash';
  const urgency = pre ? 1 : urgent ? 0.6 : 0;
  // accelerating swell + pulse
  const pulse = 1 + (0.04 + urgency * 0.09) * Math.sin((frame / (urgent ? 3 : 6)) * Math.PI * 2);
  const fuseJerk = Math.sin((frame / (urgent ? 3 : 6)) * Math.PI * 2) * (1 + urgency * 3);

  ctx.save();
  ctx.translate(0, 4);
  ctx.scale(pulse, pulse);

  // ---- stems meeting at the crown ----
  ctx.strokeStyle = GREEN_SHADE;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.quadraticCurveTo(-3, -20, 2, -24);
  ctx.moveTo(6, -12);
  ctx.quadraticCurveTo(5, -20, 2, -24);
  ctx.stroke();
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  ctx.ellipse(6, -26, 6.5, 3.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GREEN_SHADE;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ---- twitching fuse + spark ----
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(2, -24);
  ctx.quadraticCurveTo(6 + fuseJerk * 1.6, -29, 11, -32);
  ctx.stroke();
  const spark = pre ? 1 : urgent ? 0.6 : 0.25;
  if (spark > 0) {
    const sa = Math.abs(Math.sin((frame / 2) * Math.PI * 2));
    ctx.fillStyle = 'rgba(255,240,160,' + (0.4 + sa * 0.6).toFixed(2) + ')';
    const sg = ctx.createRadialGradient(11, -32, 1, 11, -32, 8);
    sg.addColorStop(0, 'rgba(255,240,160,0.95)');
    sg.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(11, -32, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- accelerating glow / white-hot pre-flash ----
  if (urgent) {
    const g = ctx.createRadialGradient(0, -4, 4, 0, -4, 30 + urgency * 10);
    g.addColorStop(0, pre ? 'rgba(255,255,240,0.9)' : 'rgba(255,170,60,0.5)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -4, 30 + urgency * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- the two personalities ----
  // left cherry: grumpy elder
  blob(ctx, -9, 0, 13.5, 13.5, '#e33b3b', '#9a1e1e', 2.2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-13.5, -5, 3.6, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, -12.5, -3, 2.7, 1.2, 1, 1);
  eye(ctx, -6, -4, 2.7, 1.2, 1, 0.4);
  mouth(ctx, -9, 5.5, 3.6, false, 1.5);
  // right cherry: nervous junior
  blob(ctx, 9, -4, 13.5, 13.5, '#d83232', '#921a1a', 2.2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(5, -9, 3.6, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, 5.5, -7.5, 2.9, 1.3, -1, urgent ? 1.2 : 0.5);
  eye(ctx, 12, -6.5, 2.9, 1.3, -1, urgent ? 1.2 : 0.5);
  mouth(ctx, 9, 1.5, 3.8, urgent, 1.5);
  // nervous sweat drop when urgent
  if (urgent) {
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(15.5, -12, 1.6, 2.6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // white-hot pre-flash silhouettes
  if (pre) {
    const a = Math.abs(Math.sin((frame / 2) * Math.PI * 2)) * 0.75;
    ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(-9, 0, 13.5, 0, Math.PI * 2);
    ctx.arc(9, -4, 13.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // ground tremble specks at max urgency
  if (pre) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(120,100,60,0.5)';
      ctx.beginPath();
      ctx.arc(-20 + r.range(0, 40), 20 + r.range(0, 4), 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
