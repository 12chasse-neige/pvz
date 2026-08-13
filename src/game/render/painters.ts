import type { Entity, World } from '../../core/ecs/World';
import { clamp } from '../../core/math';
import type { Fuse, Health, MowerC, Particle, Position, Producer, RangedAttack, Renderable, ZombieBrain, ZombieInfo } from '../components';
import { ZOMBIES } from '../content';
import type { ZombieAccessory } from '../content';

/* ---------- small helpers ---------- */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- plant painters ---------- */

function stem(ctx: CanvasRenderingContext2D, dark: string): void {
  ctx.fillStyle = dark;
  rr(ctx, -3, 12, 6, 26, 3);
  ctx.fill();
  ctx.fillStyle = '#3fae3f';
  ctx.beginPath();
  ctx.ellipse(-9, 24, 8, 4, -0.6, 0, Math.PI * 2);
  ctx.ellipse(9, 28, 8, 4, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

export interface SunflowerOpts {
  /** 0..1 - glow when about to produce sun. */
  glow: number;
}

export function paintSunflower(ctx: CanvasRenderingContext2D, t: number, o: SunflowerOpts): void {
  ctx.save();
  ctx.rotate(Math.sin(t * 1.8) * 0.05);
  stem(ctx, '#2f8f2f');
  if (o.glow > 0) {
    ctx.fillStyle = 'rgba(255, 235, 110, ' + (o.glow * 0.5).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(0, -6, 26 + o.glow * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  const petals = 10;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + t * 0.25;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -15);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d89f1e';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  circle(ctx, 0, -6, 13, '#8b5a2b');
  ctx.strokeStyle = '#6b4220';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -6, 13, 0, Math.PI * 2);
  ctx.stroke();
  circle(ctx, -4, -9, 2.2, '#3a2410');
  circle(ctx, 4, -9, 2.2, '#3a2410');
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -3, 5, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

export interface PeashooterOpts {
  frozen: boolean;
  /** 0..1 muzzle recoil right after a shot. */
  recoil: number;
}

export function paintPeashooter(ctx: CanvasRenderingContext2D, _t: number, o: PeashooterOpts): void {
  const body = o.frozen ? '#6fc3e8' : '#3fbf3f';
  const dark = o.frozen ? '#3a7fae' : '#2f8f2f';
  const snout = o.frozen ? '#a8ddf2' : '#7be07b';
  ctx.save();
  stem(ctx, dark);
  // Snout
  ctx.fillStyle = snout;
  rr(ctx, 2, -15, 26 - o.recoil * 9, 18, 8);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  rr(ctx, 2, -15, 26 - o.recoil * 9, 18, 8);
  ctx.stroke();
  // Mouth
  circle(ctx, 26 - o.recoil * 9, -6, 5, dark);
  // Head
  circle(ctx, 0, -3, 17, body);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -3, 17, 0, Math.PI * 2);
  ctx.stroke();
  // Eye
  circle(ctx, 2, -11, 5.5, '#fff');
  circle(ctx, 3.4, -11, 2.4, '#1c2c1c');
  // Brow
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.lineTo(6, -15);
  ctx.stroke();
  ctx.restore();
}

export interface WallnutOpts {
  hpFrac: number;
}

export function paintWallnut(ctx: CanvasRenderingContext2D, o: WallnutOpts): void {
  ctx.save();
  ctx.rotate(-0.04);
  // Body
  ctx.fillStyle = '#c98a4b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4e22';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Highlight
  ctx.fillStyle = 'rgba(255, 235, 190, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-7, -12, 9, 7, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // Face
  const sad = o.hpFrac < 0.34;
  circle(ctx, -7, -4, 3, '#3a2410');
  circle(ctx, 7, -4, 3, '#3a2410');
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  if (sad) ctx.arc(0, 8, 6, 1.2 * Math.PI, 1.8 * Math.PI);
  else ctx.arc(0, 2, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Cracks by damage tier
  if (o.hpFrac < 0.67) {
    ctx.strokeStyle = '#7a4e22';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-16, 14);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-12, 0);
    ctx.moveTo(16, -10);
    ctx.lineTo(8, -14);
    ctx.lineTo(10, -20);
    ctx.stroke();
  }
  if (o.hpFrac < 0.34) {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(4, 18);
    ctx.lineTo(0, 8);
    ctx.lineTo(5, 0);
    ctx.moveTo(-14, -14);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-9, -2);
    ctx.stroke();
  }
  ctx.restore();
}

export interface CherryOpts {
  /** Remaining fuse fraction 0..1. */
  frac: number;
}

export function paintCherry(ctx: CanvasRenderingContext2D, t: number, o: CherryOpts): void {
  const urgency = 1 - o.frac;
  const pulse = 1 + 0.08 * Math.sin(t * (3 + urgency * 18));
  ctx.save();
  ctx.scale(pulse, pulse);
  // Stems
  ctx.strokeStyle = '#2f8f2f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.quadraticCurveTo(-2, -18, 2, -22);
  ctx.moveTo(4, -10);
  ctx.quadraticCurveTo(6, -18, 2, -22);
  ctx.stroke();
  // Leaf
  ctx.fillStyle = '#3fae3f';
  ctx.beginPath();
  ctx.ellipse(4, -24, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Cherries
  circle(ctx, -8, 2, 13, '#e33b3b');
  circle(ctx, 8, -2, 13, '#d83232');
  ctx.strokeStyle = '#8a1c1c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-8, 2, 13, 0, Math.PI * 2);
  ctx.arc(8, -2, 13, 0, Math.PI * 2);
  ctx.stroke();
  // Shine
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-12, -3, 3.5, 5, 0.5, 0, Math.PI * 2);
  ctx.ellipse(4, -7, 3.5, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Angry eyes
  circle(ctx, -12, -2, 1.8, '#fff');
  circle(ctx, 4, -6, 1.8, '#fff');
  // Fuse flash
  if (urgency > 0.55) {
    const a = (urgency - 0.55) * 1.6 * Math.abs(Math.sin(t * 34));
    ctx.fillStyle = 'rgba(255, 255, 255, ' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(-8, 2, 13, 0, Math.PI * 2);
    ctx.arc(8, -2, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- zombie painter ---------- */

export interface ZombieOpts {
  eating: boolean;
  slowed: boolean;
  /** 0..1 hit-flash intensity. */
  flash: number;
  accessory: ZombieAccessory;
}

export function paintZombie(ctx: CanvasRenderingContext2D, t: number, o: ZombieOpts): void {
  const skin = o.slowed ? '#9db8c8' : '#b9c9a3';
  const skinDark = o.slowed ? '#7a95a8' : '#8fa877';
  const walk = t * 7;
  const bob = o.eating ? Math.sin(t * 10) * 1.5 : Math.abs(Math.sin(walk)) * -1.6;
  ctx.save();
  // Legs
  ctx.fillStyle = '#4a3f36';
  for (const side of [-1, 1]) {
    const phase = o.eating ? 0 : walk + (side > 0 ? Math.PI : 0);
    const angle = Math.sin(phase) * 0.45;
    ctx.save();
    ctx.translate(side * 6, 8);
    ctx.rotate(angle);
    rr(ctx, -3.5, 0, 7, 20, 3);
    ctx.fill();
    ctx.restore();
  }
  // Body (shirt + pants)
  ctx.fillStyle = '#6b5646';
  rr(ctx, -11, -20, 22, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#4a3f36';
  rr(ctx, -11, -2, 22, 12, 4);
  ctx.fill();
  // Arms reaching forward
  ctx.strokeStyle = skin;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  const handY = o.eating ? 0 + Math.sin(t * 12) * 3 : 2 + bob;
  ctx.beginPath();
  ctx.moveTo(-9, -15);
  ctx.lineTo(14, handY - 4);
  ctx.moveTo(9, -15);
  ctx.lineTo(18, handY + 2);
  ctx.stroke();
  ctx.fillStyle = skinDark;
  circle(ctx, 15, handY - 4, 3.5, skinDark);
  circle(ctx, 19, handY + 2, 3.5, skinDark);
  // Head
  const hy = -32 + bob * 0.4;
  circle(ctx, 3, hy, 11, skin);
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(3, hy, 11, 0, Math.PI * 2);
  ctx.stroke();
  // Face
  circle(ctx, 0, hy - 3, 1.8, '#2a2418');
  circle(ctx, 6, hy - 3, 1.8, '#2a2418');
  ctx.fillStyle = '#2a2418';
  ctx.beginPath();
  ctx.ellipse(4, hy + 3, 4, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Accessory
  switch (o.accessory) {
    case 'cone': {
      ctx.fillStyle = '#d8823c';
      ctx.beginPath();
      ctx.moveTo(-7, hy - 6);
      ctx.lineTo(14, hy - 6);
      ctx.lineTo(3, hy - 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#a05a20';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'bucket': {
      ctx.fillStyle = '#9aa0a6';
      rr(ctx, -5, hy - 16, 17, 15, 2);
      ctx.fill();
      ctx.strokeStyle = '#6a7076';
      ctx.lineWidth = 1.5;
      rr(ctx, -5, hy - 16, 17, 15, 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, hy - 16, 9, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case 'flag': {
      ctx.strokeStyle = '#8a6a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 10);
      ctx.lineTo(16, hy - 18);
      ctx.stroke();
      ctx.fillStyle = '#e33b3b';
      rr(ctx, 16, hy - 18, 17, 12, 1);
      ctx.fill();
      break;
    }
    case 'none':
      break;
  }
  // Hit flash
  if (o.flash > 0) {
    ctx.globalAlpha = Math.min(0.65, o.flash * 6);
    circle(ctx, 0, -14, 30, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---------- other entities ---------- */

export function paintPea(ctx: CanvasRenderingContext2D, o: { frozen: boolean }): void {
  const fill = o.frozen ? '#7fd4ff' : '#63c93c';
  const dark = o.frozen ? '#4a9cc8' : '#3f8f28';
  circle(ctx, 0, 0, 7, fill);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.stroke();
  circle(ctx, -2, -2, 2, 'rgba(255, 255, 255, 0.85)');
  if (o.frozen) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(8, 8);
    ctx.moveTo(-4, 4);
    ctx.lineTo(-8, 8);
    ctx.stroke();
  }
}

export function paintSunEntity(ctx: CanvasRenderingContext2D, t: number): void {
  const pulse = 1 + 0.06 * Math.sin(t * 3);
  const bob = Math.sin(t * 3) * 2;
  ctx.save();
  ctx.translate(0, bob);
  ctx.scale(pulse, pulse);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
  glow.addColorStop(0, 'rgba(255, 230, 100, 0.75)');
  glow.addColorStop(1, 'rgba(255, 230, 100, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
    ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
    ctx.stroke();
  }
  circle(ctx, 0, 0, 12, '#ffd84d');
  ctx.strokeStyle = '#e8a92e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function paintMower(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.save();
  if (t > 0) ctx.translate(0, Math.sin(t * 40) * 0.8); // tiny rumble while active
  ctx.fillStyle = '#8a8f96';
  rr(ctx, -24, -12, 48, 22, 6);
  ctx.fill();
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = 2;
  rr(ctx, -24, -12, 48, 22, 6);
  ctx.stroke();
  ctx.fillStyle = '#b0b6bc';
  rr(ctx, -20, -9, 26, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#3a3f46';
  circle(ctx, -13, 12, 8, '#3a3f46');
  circle(ctx, 13, 12, 8, '#3a3f46');
  circle(ctx, -13, 12, 3, '#7a7f86');
  circle(ctx, 13, 12, 3, '#7a7f86');
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(18, -8);
  ctx.lineTo(26, -22);
  ctx.stroke();
  ctx.restore();
}

export function paintParticle(ctx: CanvasRenderingContext2D, o: { ttlFrac: number; color: string; size: number }): void {
  ctx.globalAlpha = Math.max(0, Math.min(1, o.ttlFrac * 1.6));
  ctx.fillStyle = o.color;
  ctx.beginPath();
  ctx.arc(0, 0, o.size * (0.5 + 0.5 * o.ttlFrac), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ---------- dispatcher ---------- */

/** Draw one entity by reading its components (renderer never mutates state). */
export function paintEntity(ctx: CanvasRenderingContext2D, world: World, e: Entity): void {
  const r = world.get<Renderable>(e, 'Renderable');
  const p = world.get<Position>(e, 'Position');
  if (!r || !p) return;
  const t = world.resources.time as number;
  ctx.save();
  ctx.translate(p.x, p.y);
  switch (r.kind) {
    case 'sunflower': {
      const prod = world.get<Producer>(e, 'Producer');
      const remaining = prod ? prod.cooldown / prod.interval : 1;
      const glow = remaining < 0.25 ? (0.25 - remaining) / 0.25 : 0;
      paintSunflower(ctx, t + r.anim, { glow });
      break;
    }
    case 'peashooter':
    case 'snowpea': {
      const atk = world.get<RangedAttack>(e, 'RangedAttack');
      const recoil = atk ? clamp(1 - (t - atk.lastShot) / 0.15, 0, 1) : 0;
      paintPeashooter(ctx, t + r.anim, { frozen: r.kind === 'snowpea', recoil });
      break;
    }
    case 'wallnut': {
      const h = world.get<Health>(e, 'Health');
      paintWallnut(ctx, { hpFrac: h ? h.hp / h.max : 1 });
      break;
    }
    case 'cherrybomb': {
      const f = world.get<Fuse>(e, 'Fuse');
      paintCherry(ctx, t + r.anim, { frac: f ? clamp(f.time / f.maxTime, 0, 1) : 1 });
      break;
    }
    case 'zombie': {
      const zi = world.get<ZombieInfo>(e, 'ZombieInfo');
      const b = world.get<ZombieBrain>(e, 'ZombieBrain');
      const h = world.get<Health>(e, 'Health');
      paintZombie(ctx, t + r.anim, {
        eating: b?.eating ?? false,
        slowed: b ? t < b.slowUntil : false,
        flash: h?.flash ?? 0,
        accessory: ZOMBIES[zi?.kind ?? 'basic'].accessory,
      });
      break;
    }
    case 'pea':
      paintPea(ctx, { frozen: false });
      break;
    case 'pea-frozen':
      paintPea(ctx, { frozen: true });
      break;
    case 'sun':
      paintSunEntity(ctx, t);
      break;
    case 'mower': {
      const m = world.get<MowerC>(e, 'MowerC');
      paintMower(ctx, m?.active ? t : 0);
      break;
    }
    case 'particle': {
      const pt = world.get<Particle>(e, 'Particle');
      if (pt) paintParticle(ctx, { ttlFrac: clamp(pt.ttl / pt.maxTtl, 0, 1), color: pt.color, size: pt.size });
      break;
    }
  }
  ctx.restore();
}

/* ---------- seed-card icons (static) ---------- */

export function drawIcon(ctx: CanvasRenderingContext2D, kind: string): void {
  switch (kind) {
    case 'sunflower':
      paintSunflower(ctx, 0, { glow: 0 });
      break;
    case 'peashooter':
      paintPeashooter(ctx, 0, { frozen: false, recoil: 0 });
      break;
    case 'snowpea':
      paintPeashooter(ctx, 0, { frozen: true, recoil: 0 });
      break;
    case 'wallnut':
      paintWallnut(ctx, { hpFrac: 1 });
      break;
    case 'cherrybomb':
      paintCherry(ctx, 0, { frac: 1 });
      break;
    case 'zombie':
      paintZombie(ctx, 0, { eating: false, slowed: false, flash: 0, accessory: 'none' });
      break;
    default:
      circle(ctx, 0, 0, 8, '#888');
      break;
  }
}
