/**
 * Peashooter source art. Frames are drawn around the ground-contact pivot
 * (0,0) at logical scale; the bake script rasterizes each frame at 2×.
 */
import { blob, eye, frameRng, outline, rr, speckle } from './helpers';
import { GREEN, GREEN_DEEP, GREEN_SHADE, ICE, ICE_LIGHT, ICE_SHADE, LEAF, SNOUT } from './palette';

export const PEASHOOTER_W = 56;
export const PEASHOOTER_H = 62;

export interface PeashooterOpts {
  frozen?: boolean;
  /** Clip being drawn: 'idle' | 'fire' | 'hit'. */
  clip: 'idle' | 'fire' | 'hit';
  /** Frame index inside the clip. */
  frame: number;
}

function plantColors(o: PeashooterOpts): { body: string; shade: string; snout: string; leaf: string } {
  if (o.frozen) return { body: ICE, shade: ICE_SHADE, snout: ICE_LIGHT, leaf: '#5fa8cc' };
  return { body: GREEN, shade: GREEN_SHADE, snout: SNOUT, leaf: LEAF };
}

export function drawPeashooterFrame(ctx: CanvasRenderingContext2D, o: PeashooterOpts): void {
  const c = plantColors(o);
  const r = frameRng(1100 + (o.clip === 'fire' ? 200 : o.clip === 'hit' ? 400 : 0) + o.frame * 7);
  const breathe = o.clip === 'idle' ? 1 + Math.sin((o.frame / 5) * Math.PI * 2) * 0.025 : 1;
  const blink = o.clip === 'idle' && o.frame === 3;
  const fire = o.clip === 'fire';
  const hit = o.clip === 'hit';
  const recoil = fire ? (o.frame === 0 ? 2.5 : o.frame === 1 ? -6 : -1.5) : 0;
  const mouthOpen = fire ? (o.frame === 0 ? 1 : o.frame === 1 ? 0.35 : 0.6) : 0.55;
  const leafSway = o.clip === 'idle' ? Math.sin((o.frame / 5) * Math.PI * 2) * 0.35 : -0.15;
  // bite squash: compress down, bulge out, recover
  const squash = hit ? [0.88, 0.95][Math.min(o.frame, 1)]! : 1;

  ctx.save();
  ctx.translate(0, 4);
  ctx.scale(breathe * (2 - squash), (1 / breathe) * squash);

  // ---- stem + leaves (counter-motion) ----
  ctx.strokeStyle = c.shade;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.quadraticCurveTo(-2 + recoil * 0.4, 8, -1, 18);
  ctx.stroke();
  // leaf 1
  ctx.save();
  ctx.translate(-2, 6);
  ctx.rotate(leafSway - 0.5);
  ctx.fillStyle = c.leaf;
  ctx.beginPath();
  ctx.ellipse(-8, 0, 9, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.shade;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  // leaf 2
  ctx.save();
  ctx.translate(3, 11);
  ctx.rotate(-leafSway + 0.4);
  ctx.fillStyle = c.leaf;
  ctx.beginPath();
  ctx.ellipse(9, 0, 9, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.shade;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // ---- body pod ----
  ctx.save();
  ctx.translate(recoil, 0);
  blob(ctx, 0, -16, 15, 14, c.body, c.shade, 2.6);
  // pod rib
  ctx.strokeStyle = 'rgba(20,60,20,0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -16, 11, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // ---- snout ----
  const snoutLen = 24 + (o.frame === 1 ? -7 : 0);
  ctx.fillStyle = c.snout;
  rr(ctx, 4, -22, snoutLen, 15, 7);
  ctx.fill();
  ctx.strokeStyle = c.shade;
  ctx.lineWidth = 2.2;
  rr(ctx, 4, -22, snoutLen, 15, 7);
  ctx.stroke();
  // snout shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  rr(ctx, 8, -20, snoutLen - 8, 4, 2);
  ctx.fill();
  // snout speckle
  speckle(ctx, r, 8, -19, snoutLen - 10, 9, 6, 'rgba(20,80,20,0.15)', 0.6);

  // ---- mouth ----
  ctx.fillStyle = GREEN_DEEP;
  ctx.beginPath();
  ctx.ellipse(4 + snoutLen, -14.5, 3.4, 2.6 + mouthOpen * 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.shade;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // ---- head cap (top of pod) ----
  blob(ctx, -2, -28, 12, 7, c.body, c.shade, 2.4, -0.15);
  // sprout
  ctx.strokeStyle = c.leaf;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -33);
  ctx.quadraticCurveTo(-8, -39, -4, -42);
  ctx.stroke();

  // ---- face ----
  const lookX = 2.4;
  eye(ctx, 2, -18, 5.6, 2.3, lookX, -0.4);
  if (blink) {
    ctx.strokeStyle = GREEN_DEEP;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3.6, -18);
    ctx.lineTo(7.6, -18);
    ctx.stroke();
  }
  // brow
  outline(ctx, 2, () => {
    ctx.moveTo(-2, -24.5);
    ctx.quadraticCurveTo(3, -26.5, 8, -25.5);
  });
  // cheek
  ctx.fillStyle = 'rgba(255,150,120,0.35)';
  ctx.beginPath();
  ctx.ellipse(-4, -12.5, 3.4, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // frozen crystals + icicle spikes (distinct icy silhouette)
  if (o.frozen) {
    // hanging icicles under the snout
    ctx.fillStyle = 'rgba(230,248,255,0.95)';
    for (const [ix, iy, il] of [[8, -7, 7], [16, -6, 5], [22, -8, 8]] as const) {
      ctx.beginPath();
      ctx.moveTo(ix - 2.6, iy);
      ctx.lineTo(ix, iy + il);
      ctx.lineTo(ix + 2.6, iy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,150,190,0.7)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    // crystal clusters on pod + stem
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, -30);
    ctx.lineTo(-17, -37);
    ctx.moveTo(-14, -33);
    ctx.lineTo(-8, -35);
    ctx.moveTo(-12, -33);
    ctx.lineTo(-13, -28);
    ctx.moveTo(10, -26);
    ctx.lineTo(15, -31);
    ctx.moveTo(12, -27);
    ctx.lineTo(8, -30);
    ctx.stroke();
    // frost cap on the pod
    ctx.strokeStyle = 'rgba(230,248,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -16, 15.5, Math.PI * 1.05, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}
