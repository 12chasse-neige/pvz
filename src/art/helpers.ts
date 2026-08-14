/**
 * Painted-look canvas helpers shared by every art module.
 * Runs identically in Node (@napi-rs/canvas) and the browser, so the bake
 * output and the runtime fallback painters match exactly.
 */
import { Rng } from '../core/Rng';
import { INK } from './palette';

/** Deterministic RNG for a (sprite, frame) pair — reproducible texture. */
export function frameRng(seed: number): Rng {
  return new Rng((seed * 2654435761) >>> 0);
}

export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Painted body: light catches the upper-left, a shaded rim sinks into the
 * lower-right, then the ink outline closes the silhouette.
 */
export function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  base: string,
  shade: string,
  inkW: number,
  rotate = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, rx * 0.1, 0, 0, Math.max(rx, ry) * 1.25);
  g.addColorStop(0, lighten(base, 0.22));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hand-painted edge lighting: a broken upper-left highlight and a quiet
  // lower-right reflected rim make even tiny sprites read as dimensional.
  ctx.save();
  ctx.globalAlpha = 0.48;
  ctx.strokeStyle = lighten(base, 0.52);
  ctx.lineWidth = Math.max(0.8, inkW * 0.48);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(1, rx - inkW * 0.72), Math.max(1, ry - inkW * 0.72), 0, Math.PI * 1.08, Math.PI * 1.58);
  ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = shade;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(1, rx - inkW * 0.68), Math.max(1, ry - inkW * 0.68), 0, Math.PI * 0.08, Math.PI * 0.64);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = inkW;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Seeded speckle texture inside a rect (painted grain). */
export function speckle(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  color: string,
  alpha: number,
  sizeMin = 0.8,
  sizeMax = 1.8,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const s = rng.range(sizeMin, sizeMax);
    ctx.beginPath();
    ctx.arc(x + rng.range(0, w), y + rng.range(0, h), s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Soft contact shadow ellipse (offset toward lower-right of light). */
export function contactShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1d2a16';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.08, y + 3, w / 2, w * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Simple eye: white sclera, dark pupil, catch light. */
export function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  pupilR: number,
  lookX = 0,
  lookY = 0,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.stroke();
  ctx.fillStyle = '#241a12';
  ctx.beginPath();
  ctx.arc(x + lookX, y + lookY, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x + lookX - pupilR * 0.35, y + lookY - pupilR * 0.35, pupilR * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

/** Simple smile / frown stroke with round caps. */
export function mouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  frown: boolean,
  lineW: number,
): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (frown) ctx.arc(x, y + w * 0.55, w * 0.62, Math.PI * 1.2, Math.PI * 1.8);
  else ctx.arc(x, y - w * 0.1, w * 0.55, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
}

/** Shift a #rrggbb color toward white (t>0) or black (t<0). */
export function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const f = (v: number): number =>
    t >= 0 ? Math.round(v + (255 - v) * t) : Math.round(v * (1 + t));
  return '#' + [f(r), f(g), f(b)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/** Stroke path with ink outline. */
export function outline(
  ctx: CanvasRenderingContext2D,
  lineW: number,
  draw: () => void,
  color = INK,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  draw();
  ctx.stroke();
}
