/**
 * Zombie family source art: basic, conehead, buckethead, runner and flag
 * zombie. Distinct silhouettes and movement weight per variant (not a
 * basic body with a sticker), accessory damage tiers (dent/loosen as
 * health falls), uneven gait, dangling jaw, independent arm motion and a
 * staged defeat. Frames face LEFT; runtime flips for menu vignettes.
 */
import { blob, frameRng, rr, speckle } from './helpers';
import { INK, Z_BUCKET, Z_BUCKET_SHADE, Z_CONE, Z_CONE_SHADE, Z_PANTS, Z_SHIRT, Z_SHOE, Z_SKIN, Z_SKIN_ACCENT, Z_SKIN_SHADE, Z_TIE } from './palette';

export type ZombieVariant = 'basic' | 'cone' | 'bucket' | 'runner' | 'flag';
export type ZombieClip = 'walk' | 'eat' | 'death';
/** Accessory damage tier: 0 pristine, 1 dented, 2 badly dented/loose. */
export type ZombieTier = 0 | 1 | 2;

export const ZOMBIE_VARIANT_W = 96;
export const ZOMBIE_VARIANT_H = 110;

const TAU = Math.PI * 2;

export interface ZombieDrawOpts {
  clip: ZombieClip;
  frame: number;
  kind: ZombieVariant;
  tier?: ZombieTier;
}

export function drawZombieFrame(ctx: CanvasRenderingContext2D, o: ZombieDrawOpts): void {
  if (o.clip === 'death') {
    ctx.save();
    ctx.translate(0, 2);
    drawDeath(ctx, frameRng(2200 + o.frame * 13), o.frame);
    ctx.restore();
    return;
  }
  const kind = o.kind;
  const tier: ZombieTier = o.tier ?? 0;
  const eat = o.clip === 'eat';
  const r = frameRng(2200 + o.frame * 13 + kind.charCodeAt(0) * 31 + tier * 17);

  // ---- variant movement weights ----
  const runner = kind === 'runner';
  const heavy = kind === 'bucket';
  const proud = kind === 'flag';
  const cadence = runner ? 0.62 : heavy ? 0.3 : 0.42;
  const cadenceFreq = runner ? 1.25 : 1;
  const phase = (o.frame / 8) * TAU * cadenceFreq;
  const bobScale = eat ? 1 : heavy ? 0.65 : 1;
  const bob = eat ? Math.sin((o.frame / 4) * TAU) * 1.4 : Math.abs(Math.sin(phase)) * -1.8 * bobScale;
  const lean = eat ? 0.2 : runner ? 0.34 : proud ? -0.08 : 0.1;

  ctx.save();
  ctx.translate(0, 2 + bob);

  // ---- runner shirt flap (behind the body) ----
  if (runner && !eat) {
    const flap = Math.sin(phase) * 5;
    ctx.fillStyle = Z_SHIRT;
    ctx.beginPath();
    ctx.moveTo(-8, -50);
    ctx.quadraticCurveTo(-18 - flap, -34, -14 - flap * 1.4, -22);
    ctx.lineTo(-4, -24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  ctx.save();
  ctx.rotate(lean);

  // ---- legs ----
  for (const side of [-1, 1] as const) {
    const legPhase = eat ? 0.1 * side : phase + (side > 0 ? Math.PI : 0);
    const swing = Math.sin(legPhase) * (eat ? 0.06 : cadence);
    ctx.save();
    ctx.translate(side * (runner ? 8 : 6), -26);
    ctx.rotate(swing + (runner ? 0.18 : 0));
    ctx.strokeStyle = Z_PANTS;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.rotate(Math.sin(legPhase + 0.7) * (eat ? 0.02 : cadence * 0.7));
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(side * 2, 24);
    ctx.stroke();
    // shoe
    ctx.fillStyle = Z_SHOE;
    ctx.beginPath();
    ctx.ellipse(side * 2 + (eat ? 0 : runner ? 3 : 2), 25, 6, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // ---- torso ----
  const torsoW = kind === 'cone' || kind === 'bucket' ? 30 : 26;
  ctx.fillStyle = kind === 'cone' ? '#8a6a3a' : Z_SHIRT;
  rr(ctx, -torsoW / 2, -56, torsoW, 32, 7);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  rr(ctx, -torsoW / 2, -56, torsoW, 32, 7);
  ctx.stroke();
  if (kind === 'cone') {
    // high-vis work vest stripes
    ctx.fillStyle = 'rgba(255,190,60,0.85)';
    ctx.fillRect(-torsoW / 2, -52, torsoW, 4);
    ctx.fillRect(-torsoW / 2, -44, torsoW, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-torsoW / 2, -56, torsoW, 3);
  } else if (kind === 'bucket') {
    // suspenders + belly
    ctx.fillStyle = '#2e2a24';
    ctx.fillRect(-9, -56, 4, 18);
    ctx.fillRect(5, -56, 4, 18);
    ctx.fillStyle = 'rgba(20,12,6,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, -34, 10, 8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,12,6,0.16)';
  rr(ctx, 1, -50, 12, 26, 6);
  ctx.fill();
  speckle(ctx, r, -11, -54, 22, 26, 6, 'rgba(0,0,0,0.12)', 0.5);
  if (kind === 'basic') {
    ctx.fillStyle = Z_TIE;
    ctx.save();
    ctx.translate(-1, -52);
    ctx.rotate(Math.sin(phase) * 0.16);
    rr(ctx, -2.4, 0, 4.8, 17, 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- arms (independent motion) ----
  ctx.strokeStyle = Z_SKIN;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const side of [-1, 1] as const) {
    const swing = eat
      ? Math.sin((o.frame / 4) * TAU + side) * 0.12
      : Math.sin(phase + side) * (runner ? 0.5 : 0.3);
    ctx.save();
    ctx.translate(side * 4, -46);
    ctx.rotate(runner ? 0.5 + swing * (side > 0 ? -1 : 1) : -0.9 + swing * (side > 0 ? -1 : 1));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, eat ? 12 : 16);
    ctx.stroke();
    ctx.fillStyle = Z_SKIN_SHADE;
    ctx.beginPath();
    ctx.arc(0, eat ? 13 : 17, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (eat) {
    ctx.fillStyle = Z_SKIN_SHADE;
    ctx.beginPath();
    ctx.arc(-13, -46, 4, 0, TAU);
    ctx.arc(-8, -48, 4, 0, TAU);
    ctx.fill();
  }

  // ---- flag zombie: pole + waving cloth + leadership gesture ----
  if (kind === 'flag') {
    const poleX = 12;
    const wave = Math.sin(phase * 1.5);
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(poleX, 22);
    ctx.lineTo(poleX, -70);
    ctx.stroke();
    ctx.fillStyle = '#a8322a';
    ctx.beginPath();
    ctx.moveTo(poleX, -70 + wave * 1.5);
    ctx.quadraticCurveTo(poleX + 13, -71 + wave * 2, poleX + 19, -64 + wave * 3);
    ctx.quadraticCurveTo(poleX + 12, -61, poleX + 19, -55 + wave * 2);
    ctx.quadraticCurveTo(poleX + 10, -57, poleX, -53);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // painted skull on the flag
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.arc(poleX + 9, -63 + wave * 1.4, 3.4, 0, TAU);
    ctx.fill();
    ctx.fillRect(poleX + 7.6, -61.6 + wave * 1.4, 2.8, 2.4);
    // raised leadership fist on the free arm
    ctx.fillStyle = Z_SKIN_SHADE;
    ctx.beginPath();
    ctx.arc(-14, -58 + Math.sin(phase) * 1.5, 4, 0, TAU);
    ctx.fill();
  }

  // ---- head ----
  const hx = runner ? -9 : -7;
  const hy = proud ? -68 : -66;
  const headTilt = eat ? 0.12 : proud ? -0.1 : 0.04;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(headTilt);
  blob(ctx, 0, 0, 12, 11.5, Z_SKIN, Z_SKIN_SHADE, 2.4);
  // sunken cheek
  ctx.fillStyle = 'rgba(60,70,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(3, 3, 4.5, 3.4, 0, 0, TAU);
  ctx.fill();

  // dangling jaw
  const jawOpen = eat ? (o.frame === 0 || o.frame === 2 ? 0.5 : 0.15) : 0.3 + Math.sin(phase * 2) * 0.08;
  ctx.save();
  ctx.translate(-3, 6);
  ctx.rotate(jawOpen * 0.5);
  blob(ctx, 0, 2, 5.4, 4.2, Z_SKIN_ACCENT, Z_SKIN_SHADE, 2);
  ctx.fillStyle = '#e8e4d0';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(-4 + i * 3, -1.6 - jawOpen * 1.5, 2.2, 2.6);
  }
  ctx.restore();

  // eyes (blink on a fixed frame of the walk cycle)
  const blink = !eat && o.frame === 3;
  for (const ex of [-6, 2] as const) {
    if (blink) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ex - 2.4, -4.4);
      ctx.lineTo(ex + 1.4, -3.4);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, -4, 2.6, 2.9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = '#241a12';
    ctx.beginPath();
    ctx.arc(ex - 0.8, -3.4, 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.lineTo(-3.4, -7.4);
  ctx.moveTo(-0.6, -7.6);
  ctx.lineTo(5, -9.2);
  ctx.stroke();
  // messy hair (hidden under accessories)
  if (kind === 'basic' || kind === 'runner') {
    ctx.fillStyle = '#4a4030';
    ctx.beginPath();
    ctx.ellipse(-1, -11, 9, 3.6, -0.2, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // ---- accessories with damage tiers ----
  if (kind === 'cone') {
    drawCone(ctx, tier, o.frame);
  } else if (kind === 'bucket') {
    drawBucket(ctx, tier, o.frame);
  }
  ctx.restore(); // head
  ctx.restore(); // lean
  ctx.restore(); // body translate

  // speed streaks behind the runner (baked for readability)
  if (runner && !eat) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = -58 + i * 22 + Math.sin(phase + i) * 2;
      const len = 10 + ((o.frame + i) % 3) * 6;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin((o.frame / 8) * TAU * 2 + i);
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(8 + len, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

/** Traffic cone: pristine → dented → crumpled and pushed up. */
function drawCone(ctx: CanvasRenderingContext2D, tier: ZombieTier, frame: number): void {
  const wobble = Math.sin((frame / 8) * TAU) * 1.2;
  ctx.save();
  ctx.rotate(wobble * 0.02);
  const topY = tier === 2 ? -24 : -30;
  const crumple = tier === 2;
  const pts: [number, number][] = crumple
    ? [[-8, -7], [6, -6], [13, -9], [4, -16], [9, -20], [1, -24]]
    : [[-8, -7], [14, -7], [3, topY]];
  ctx.fillStyle = Z_CONE;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = Z_CONE_SHADE;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // cone base rim
  ctx.fillStyle = Z_CONE_SHADE;
  rr(ctx, -9, -9, 25, 4, 2);
  ctx.fill();
  // dents + cracks
  if (tier >= 1) {
    ctx.fillStyle = 'rgba(90,40,10,0.4)';
    ctx.beginPath();
    ctx.ellipse(6, -16, 3.4, 2.4, -0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#6b3a10';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(4, -28);
    ctx.lineTo(7, -22);
    ctx.lineTo(4, -18);
    ctx.stroke();
  }
  if (tier >= 2) {
    ctx.strokeStyle = '#6b3a10';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, -9);
    ctx.lineTo(12, -15);
    ctx.lineTo(9, -19);
    ctx.moveTo(-4, -20);
    ctx.lineTo(0, -16);
    ctx.stroke();
  }
  ctx.restore();
}

/** Steel bucket: pristine → dented → tilted loose over one eye. */
function drawBucket(ctx: CanvasRenderingContext2D, tier: ZombieTier, frame: number): void {
  const wobble = Math.sin((frame / 8) * TAU) * 1.4;
  ctx.save();
  ctx.rotate(wobble * 0.02 + (tier === 2 ? 0.22 : 0));
  const bx = tier === 2 ? 3 : 0;
  const by = tier === 2 ? -11 : -15;
  ctx.fillStyle = Z_BUCKET;
  rr(ctx, bx - 6, by - 2, 17, 15, 2);
  ctx.fill();
  ctx.strokeStyle = Z_BUCKET_SHADE;
  ctx.lineWidth = 1.8;
  rr(ctx, bx - 6, by - 2, 17, 15, 2);
  ctx.stroke();
  // handle
  ctx.beginPath();
  ctx.arc(bx + 2, by - 2, 9, Math.PI, 0);
  ctx.stroke();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rr(ctx, bx - 3, by, 4, 10, 2);
  ctx.fill();
  // dents
  if (tier >= 1) {
    ctx.fillStyle = 'rgba(30,34,40,0.5)';
    ctx.beginPath();
    ctx.ellipse(bx + 6, by + 5, 4, 3, 0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by + 8);
    ctx.lineTo(bx, by + 4);
    ctx.stroke();
  }
  if (tier >= 2) {
    ctx.fillStyle = 'rgba(30,34,40,0.6)';
    ctx.beginPath();
    ctx.ellipse(bx - 3, by + 1, 3.4, 4, 0.6, 0, TAU);
    ctx.fill();
  }
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

  ctx.fillStyle = Z_SHIRT;
  rr(ctx, -13, -56, 26, 32, 7);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  rr(ctx, -13, -56, 26, 32, 7);
  ctx.stroke();

  ctx.strokeStyle = Z_SKIN;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-10, -50);
  ctx.lineTo(-22, -62 + s.arm * 6);
  ctx.moveTo(8, -50);
  ctx.lineTo(18, -64 + s.arm * 6);
  ctx.stroke();

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

  if (frame >= 2) speckle(ctx, r, -26, -14, 52, 12, 14, 'rgba(120,110,80,0.5)', 0.7);

  ctx.restore();
}
