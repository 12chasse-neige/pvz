/**
 * UI source art: painted garden-tool icons and the seed packet.
 * Everything is drawn in logical pixels around (0,0) at the icon center.
 */
import { blob, frameRng, rr, speckle } from './helpers';
import { BADGE, INK, PAPER, PAPER_SHADE, SUN, SUN_RIM, WOOD, WOOD_DARK } from './palette';

export const ICON_W = 40;
export const ICON_H = 40;
export const PACKET_W = 64;
export const PACKET_H = 78;

export function drawSunIcon(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 20);
  g.addColorStop(0, 'rgba(255,230,100,0.9)');
  g.addColorStop(1, 'rgba(255,230,100,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SUN;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
    ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
    ctx.stroke();
  }
  blob(ctx, 0, 0, 10.5, 10.5, SUN, SUN_RIM, 1.8);
  ctx.fillStyle = '#7a4e1e';
  ctx.beginPath();
  ctx.arc(-3, -1.5, 1.5, 0, Math.PI * 2);
  ctx.arc(3, -1.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4e1e';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 1, 3.6, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

export function drawShovelIcon(ctx: CanvasRenderingContext2D): void {
  // blade
  ctx.fillStyle = '#b8c0c8';
  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.quadraticCurveTo(0, 4, 8, -12);
  ctx.quadraticCurveTo(0, -16, -8, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  // socket + handle
  ctx.fillStyle = WOOD;
  rr(ctx, -2.4, -17, 4.8, 9, 2);
  ctx.fill();
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, -18);
  ctx.lineTo(-3.5, 12);
  ctx.moveTo(1, -18);
  ctx.lineTo(3.5, 12);
  ctx.stroke();
  // grip
  rr(ctx, -5, 9, 10, 5, 2.5);
  ctx.fillStyle = '#a05a20';
  ctx.fill();
  // glint
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-4, -8, 2.4, 3.4, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPauseIcon(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = WOOD_DARK;
  for (const x of [-8, 2] as const) {
    rr(ctx, x, -12, 6, 24, 3);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  for (const x of [-8, 2] as const) {
    rr(ctx, x, -12, 6, 24, 3);
    ctx.stroke();
  }
}

export function drawSoundOnIcon(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.moveTo(-10, -5);
  ctx.lineTo(-3, -5);
  ctx.lineTo(4, -12);
  ctx.lineTo(4, 12);
  ctx.lineTo(-3, 5);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // waves
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(9, 0, 6, -0.9, 0.9);
  ctx.arc(13, 0, 10, -0.7, 0.7);
  ctx.stroke();
}

export function drawSoundOffIcon(ctx: CanvasRenderingContext2D): void {
  drawSoundOnIcon(ctx);
  ctx.strokeStyle = '#c83a2a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(7, -9);
  ctx.lineTo(17, 9);
  ctx.moveTo(17, -9);
  ctx.lineTo(7, 9);
  ctx.stroke();
}

export function drawFlagIcon(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = WOOD;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.lineTo(0, -18);
  ctx.stroke();
  // waving cloth
  const g = ctx.createLinearGradient(-6, 0, 16, 0);
  g.addColorStop(0, '#e8533c');
  g.addColorStop(1, '#a8322a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.quadraticCurveTo(10, -15, 16, -11);
  ctx.quadraticCurveTo(11, -7, 16, -4);
  ctx.lineTo(0, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // skull hint
  ctx.fillStyle = '#f2ead8';
  ctx.beginPath();
  ctx.arc(8, -10, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(6.6, -8.4, 2.8, 2.6);
}

export function drawLockIcon(ctx: CanvasRenderingContext2D): void {
  // shackle
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -6, 7, Math.PI, 0);
  ctx.stroke();
  // body
  ctx.fillStyle = '#c8b04a';
  rr(ctx, -12, -2, 24, 16, 3);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  rr(ctx, -12, -2, 24, 16, 3);
  ctx.stroke();
  ctx.fillStyle = '#7a5a1e';
  ctx.beginPath();
  ctx.arc(0, 5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  rr(ctx, -1, 5, 2, 4, 1);
  ctx.fill();
}

/** Painted paper seed packet. `portrait` draws the plant art inside. */
export function drawSeedPacket(
  ctx: CanvasRenderingContext2D,
  portrait: (ctx: CanvasRenderingContext2D) => void,
  cost: number,
  keyLabel: string,
  costAffordable: boolean,
): void {
  const w = PACKET_W;
  const h = PACKET_H;
  ctx.save();
  // paper body
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, PAPER);
  g.addColorStop(1, PAPER_SHADE);
  ctx.fillStyle = g;
  rr(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  rr(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.stroke();
  // paper grain
  const r = frameRng(4400);
  speckle(ctx, r, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 60, 'rgba(120,90,40,0.14)', 0.6);
  // top fold
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rr(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, 8, 4);
  ctx.fill();
  // portrait window
  ctx.fillStyle = 'rgba(120,150,90,0.18)';
  rr(ctx, -w / 2 + 6, -h / 2 + 16, w - 12, h * 0.52, 5);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  rr(ctx, -w / 2 + 6, -h / 2 + 16, w - 12, h * 0.52, 5);
  ctx.clip();
  // Portrait painters use a 48x56 mini-canvas coordinate system. Align that
  // canvas with the packet window so baked and live previews share framing.
  ctx.translate(-24, -30);
  portrait(ctx);
  ctx.restore();
  // cost badge
  const bw = 26;
  const bx = w / 2 - bw / 2 - 4;
  const by = h / 2 - 20;
  ctx.fillStyle = costAffordable ? BADGE : '#8a8a80';
  ctx.beginPath();
  ctx.arc(bx, by, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = '#241a12';
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(cost), bx, by + 0.5);
  // hotkey tag
  if (keyLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    rr(ctx, -w / 2 + 6, -h / 2 + 8, 14, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#7a5a1e';
    ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
    ctx.fillText(keyLabel, -w / 2 + 13, -h / 2 + 14.5);
  }
  ctx.restore();
}

export function drawZombieIcon(ctx: CanvasRenderingContext2D): void {
  // chunky skull used for zombie previews
  ctx.save();
  ctx.scale(0.8, 0.8);
  blob(ctx, 0, 2, 12, 13, '#a8b98a', '#6f7f5a', 2.4);
  // eye sockets
  ctx.fillStyle = '#241a12';
  ctx.beginPath();
  ctx.ellipse(-4.5, -2, 3, 3.4, 0, 0, Math.PI * 2);
  ctx.ellipse(4.5, -2, 3, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // dangling jaw
  ctx.fillStyle = '#93a271';
  ctx.beginPath();
  ctx.ellipse(0, 8, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#e8e4d0';
  for (let i = 0; i < 3; i++) ctx.fillRect(-4.5 + i * 3.4, 5.4, 2, 2.4);
  ctx.restore();
}

/** Draw a plant fallback icon directly (used when the UI atlas is missing). */
export function drawUnknownIcon(ctx: CanvasRenderingContext2D): void {
  blob(ctx, 0, 0, 11, 11, '#8a8a86', '#5f5f5a', 2);
  ctx.strokeStyle = '#e8e8e0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 4, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

export function drawHudPlank(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, WOOD);
  g.addColorStop(1, WOOD_DARK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = frameRng(5500);
  speckle(ctx, r, 0, 0, w, h, Math.floor(w / 4), 'rgba(0,0,0,0.15)', 0.4, 0.8, 2);
  ctx.fillStyle = 'rgba(255,220,150,0.10)';
  ctx.fillRect(0, 0, w, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h - 3, w, 3);
}
