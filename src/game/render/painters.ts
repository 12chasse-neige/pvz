/**
 * Procedural fallback painters (used when a sprite atlas is missing, and
 * for characters not yet baked). Restyled to the storybook art bible:
 * warm ink outlines, painted two-tone shading, one light direction.
 */
import { clamp } from '../../core/math';
import { blob, eye, mouth, outline, rr } from '../../art/helpers';
import {
  GREEN,
  GREEN_DEEP,
  GREEN_SHADE,
  ICE,
  ICE_LIGHT,
  ICE_SHADE,
  INK,
  LEAF,
  PEA,
  PEA_FROZEN,
  PEA_FROZEN_RIM,
  PEA_RIM,
  SUN,
  SUN_RIM,
  Z_BUCKET,
  Z_BUCKET_SHADE,
  Z_CONE,
  Z_CONE_SHADE,
  Z_PANTS,
  Z_SHIRT,
  Z_SKIN,
  Z_SKIN_SHADE,
} from '../../art/palette';

export interface SunflowerOpts {
  glow: number;
}

function stem(ctx: CanvasRenderingContext2D, dark: string): void {
  ctx.strokeStyle = dark;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(-2, 16, -1, 24);
  ctx.stroke();
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  ctx.ellipse(-9, 22, 8, 3.8, -0.6, 0, Math.PI * 2);
  ctx.ellipse(9, 26, 8, 3.8, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

export function paintSunflower(ctx: CanvasRenderingContext2D, t: number, o: SunflowerOpts): void {
  ctx.save();
  ctx.rotate(Math.sin(t * 1.8) * 0.05);
  stem(ctx, GREEN_SHADE);
  if (o.glow > 0) {
    const g = ctx.createRadialGradient(0, -6, 4, 0, -6, 30 + o.glow * 10);
    g.addColorStop(0, 'rgba(255,235,110,' + (o.glow * 0.55).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,235,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -6, 30 + o.glow * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // layered petals (two rings, inner darker)
  const petals = 10;
  for (const ring of [1, 0] as const) {
    const rr2 = ring === 0 ? 6.4 : 9.4;
    const rad = ring === 0 ? 12 : 15;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + t * 0.25 + ring * 0.3;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -rad);
      ctx.fillStyle = ring === 0 ? '#e8a92e' : SUN;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr2, 8.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,100,20,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
  // textured face
  blob(ctx, 0, -6, 12.5, 12.5, '#8b5a2b', '#5f3a1a', 2.2);
  const r = (n: number): number => (n * 2654435761) >>> 0;
  ctx.fillStyle = 'rgba(40,20,8,0.5)';
  for (let i = 0; i < 7; i++) {
    const a = r(i + 7) / 4294967296 * Math.PI * 2;
    const d = (r(i + 21) / 4294967296) * 7;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, -6 + Math.sin(a) * d, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // happy face (blinks via glow)
  const blink = t % 4.7 > 4.55;
  eye(ctx, -4, -9, 2.8, 1.3, 0, 0);
  eye(ctx, 4, -9, 2.8, 1.3, 0, 0);
  if (blink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6.8, -9);
    ctx.lineTo(-1.2, -9);
    ctx.moveTo(1.2, -9);
    ctx.lineTo(6.8, -9);
    ctx.stroke();
  }
  mouth(ctx, 0, -2.5, 7, false, 1.6);
  // cheek blush
  ctx.fillStyle = 'rgba(255,150,120,0.4)';
  ctx.beginPath();
  ctx.ellipse(-8, -4, 2.6, 1.8, 0, 0, Math.PI * 2);
  ctx.ellipse(8, -4, 2.6, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface PeashooterOpts {
  frozen: boolean;
  recoil: number;
}

export function paintPeashooter(ctx: CanvasRenderingContext2D, _t: number, o: PeashooterOpts): void {
  const body = o.frozen ? ICE : GREEN;
  const dark = o.frozen ? ICE_SHADE : GREEN_SHADE;
  const snout = o.frozen ? ICE_LIGHT : '#7be07b';
  ctx.save();
  stem(ctx, dark);
  ctx.translate(-o.recoil * 6, 0);
  // snout
  ctx.fillStyle = snout;
  rr(ctx, 2, -15, 26, 18, 8);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.2;
  rr(ctx, 2, -15, 26, 18, 8);
  ctx.stroke();
  // mouth
  ctx.fillStyle = GREEN_DEEP;
  ctx.beginPath();
  ctx.ellipse(26, -6, 4.6, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  blob(ctx, 0, -3, 16, 16, body, dark, 2.4);
  eye(ctx, 2, -11, 5.2, 2.2, 2, 0);
  outline(ctx, 2, () => {
    ctx.moveTo(-2, -16);
    ctx.quadraticCurveTo(3, -18, 8, -16.4);
  });
  ctx.restore();
}

export interface WallnutOpts {
  hpFrac: number;
}

export function paintWallnut(ctx: CanvasRenderingContext2D, o: WallnutOpts): void {
  ctx.save();
  ctx.rotate(-0.04);
  blob(ctx, 0, 0, 22, 27, '#c98a4b', '#8a5a2c', 2.6);
  // shell texture arcs
  ctx.strokeStyle = 'rgba(90,55,25,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 17, -0.7, 0.4);
  ctx.arc(0, 4, 13, 0.5, 1.2);
  ctx.stroke();
  // highlight
  ctx.fillStyle = 'rgba(255,235,190,0.5)';
  ctx.beginPath();
  ctx.ellipse(-7, -12, 8, 6, -0.5, 0, Math.PI * 2);
  ctx.fill();
  const sad = o.hpFrac < 0.34;
  const anxious = o.hpFrac < 0.67;
  eye(ctx, -7, -4, 3.4, 1.6, 0, sad ? 1 : 0);
  eye(ctx, 7, -4, 3.4, 1.6, 0, sad ? 1 : 0);
  mouth(ctx, 0, sad ? 9 : 2, 6.5, sad, 1.8);
  if (anxious) {
    // worried brows
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, -9);
    ctx.lineTo(-5, -7.6);
    ctx.moveTo(11, -9);
    ctx.lineTo(5, -7.6);
    ctx.stroke();
  }
  if (o.hpFrac < 0.67) {
    ctx.strokeStyle = '#5a3618';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
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
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(4, 18);
    ctx.lineTo(0, 8);
    ctx.lineTo(5, 0);
    ctx.moveTo(-14, -14);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-9, -2);
    ctx.moveTo(13, 12);
    ctx.lineTo(9, 5);
    ctx.stroke();
    // missing shell chip (dark inner notch)
    ctx.fillStyle = 'rgba(58,34,12,0.85)';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(21, 1);
    ctx.lineTo(19, 7);
    ctx.lineTo(13, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

export interface CherryOpts {
  frac: number;
}

export function paintCherry(ctx: CanvasRenderingContext2D, t: number, o: CherryOpts): void {
  const urgency = 1 - o.frac;
  const pulse = 1 + 0.08 * Math.sin(t * (3 + urgency * 18));
  ctx.save();
  ctx.scale(pulse, pulse);
  // stems + leaf
  ctx.strokeStyle = GREEN_SHADE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.quadraticCurveTo(-2, -18, 2, -22);
  ctx.moveTo(4, -10);
  ctx.quadraticCurveTo(6, -18, 2, -22);
  ctx.stroke();
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  ctx.ellipse(4, -24, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // twitching fuse
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(2, -22);
  ctx.quadraticCurveTo(6 + Math.sin(t * 22) * 1.4, -27, 10, -30);
  ctx.stroke();
  // two personalities
  blob(ctx, -8, 2, 13, 13, '#e33b3b', '#9a1e1e', 2.2);
  blob(ctx, 8, -2, 13, 13, '#d83232', '#921a1a', 2.2);
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-12, -3, 3.4, 4.8, 0.5, 0, Math.PI * 2);
  ctx.ellipse(4, -7, 3.4, 4.8, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // left: grumpy, right: nervous
  eye(ctx, -11.5, -1.5, 2.6, 1.2, 1, 1);
  eye(ctx, -5.5, -2.5, 2.6, 1.2, 1, 0.6);
  eye(ctx, 4.5, -5.5, 2.6, 1.2, 0, 1);
  eye(ctx, 10.5, -4.5, 2.6, 1.2, -1, 1);
  mouth(ctx, -8.5, 4.5, 3.4, false, 1.4);
  mouth(ctx, 7.5, 1.5, 3.4, urgency > 0.5, 1.4);
  if (urgency > 0.55) {
    const a = (urgency - 0.55) * 1.6 * Math.abs(Math.sin(t * 34));
    ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(-8, 2, 13, 0, Math.PI * 2);
    ctx.arc(8, -2, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export interface ZombieOpts {
  eating: boolean;
  slowed: boolean;
  flash: number;
  accessory: 'none' | 'cone' | 'bucket' | 'flag';
  runner?: boolean;
}

export function paintZombie(ctx: CanvasRenderingContext2D, t: number, o: ZombieOpts): void {
  const skin = o.slowed ? '#9db8c8' : Z_SKIN;
  const skinDark = o.slowed ? '#7a95a8' : Z_SKIN_SHADE;
  const walk = t * (o.runner ? 9.5 : 7);
  const bob = o.eating ? Math.sin(t * 10) * 1.5 : Math.abs(Math.sin(walk)) * -1.6;
  ctx.save();
  // legs
  ctx.fillStyle = Z_PANTS;
  for (const side of [-1, 1] as const) {
    const phase = o.eating ? 0 : walk + (side > 0 ? Math.PI : 0);
    const angle = Math.sin(phase) * (o.runner ? 0.62 : 0.45);
    ctx.save();
    ctx.translate(side * 6, 8);
    ctx.rotate(angle);
    rr(ctx, -3.5, 0, 7, 20, 3);
    ctx.fill();
    ctx.restore();
  }
  // body
  ctx.fillStyle = Z_SHIRT;
  rr(ctx, -11, -20, 22, 26, 6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  rr(ctx, -11, -20, 22, 26, 6);
  ctx.stroke();
  ctx.fillStyle = Z_PANTS;
  rr(ctx, -11, -2, 22, 12, 4);
  ctx.fill();
  // arms
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
  ctx.beginPath();
  ctx.arc(15, handY - 4, 3.5, 0, Math.PI * 2);
  ctx.arc(19, handY + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // head
  const hy = -32 + bob * 0.4;
  blob(ctx, 3, hy, 11, 11, skin, skinDark, 1.8);
  // dangling jaw
  const jaw = o.eating ? Math.sin(t * 10) * 2.4 : 1.6;
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(5, hy + 7, 4.6, 3 + jaw * 0.4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  eye(ctx, 0, hy - 3, 2.6, 1.1, 0, 0);
  eye(ctx, 6, hy - 3, 2.6, 1.1, 0, 0);
  // accessory
  switch (o.accessory) {
    case 'cone': {
      ctx.fillStyle = Z_CONE;
      ctx.beginPath();
      ctx.moveTo(-7, hy - 6);
      ctx.lineTo(14, hy - 6);
      ctx.lineTo(3, hy - 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = Z_CONE_SHADE;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      break;
    }
    case 'bucket': {
      ctx.fillStyle = Z_BUCKET;
      rr(ctx, -5, hy - 16, 17, 15, 2);
      ctx.fill();
      ctx.strokeStyle = Z_BUCKET_SHADE;
      ctx.lineWidth = 1.8;
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
      ctx.beginPath();
      ctx.moveTo(16, hy - 18);
      ctx.quadraticCurveTo(26, hy - 20, 33, hy - 14);
      ctx.quadraticCurveTo(26, hy - 10, 16, hy - 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      break;
    }
    case 'none':
      break;
  }
  if (o.slowed) {
    // frost tint + rim light
    ctx.fillStyle = 'rgba(159,216,255,0.32)';
    ctx.beginPath();
    ctx.arc(3, -14, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(207,234,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(3, hy, 11.5, Math.PI * 0.9, Math.PI * 1.5);
    ctx.stroke();
  }
  if (o.flash > 0) {
    ctx.globalAlpha = Math.min(0.65, o.flash * 6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -14, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function paintPea(ctx: CanvasRenderingContext2D, o: { frozen: boolean }): void {
  const fill = o.frozen ? PEA_FROZEN : PEA;
  const dark = o.frozen ? PEA_FROZEN_RIM : PEA_RIM;
  blob(ctx, 0, 0, 7, 7, fill, dark, 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-2, -2, 1.9, 0, Math.PI * 2);
  ctx.fill();
  if (o.frozen) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
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
  glow.addColorStop(0, 'rgba(255,230,100,0.75)');
  glow.addColorStop(1, 'rgba(255,230,100,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SUN;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
    ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
    ctx.stroke();
  }
  blob(ctx, 0, 0, 12, 12, SUN, SUN_RIM, 1.8);
  ctx.restore();
}

export function paintMower(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.save();
  if (t > 0) ctx.translate(0, Math.sin(t * 40) * 0.8);
  ctx.fillStyle = '#8a8f96';
  rr(ctx, -24, -12, 48, 22, 6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  rr(ctx, -24, -12, 48, 22, 6);
  ctx.stroke();
  ctx.fillStyle = '#b04a3a';
  rr(ctx, -24, -12, 14, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#b0b6bc';
  rr(ctx, -12, -9, 20, 5, 2);
  ctx.fill();
  for (const wx of [-13, 13] as const) {
    ctx.fillStyle = '#3a3f46';
    ctx.beginPath();
    ctx.arc(wx, 12, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#7a7f86';
    ctx.beginPath();
    ctx.arc(wx, 12, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#5a5f66';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(18, -8);
  ctx.lineTo(26, -22);
  ctx.stroke();
  ctx.restore();
}

export function paintParticle(
  ctx: CanvasRenderingContext2D,
  o: { ttlFrac: number; color: string; size: number },
): void {
  const f = clamp(o.ttlFrac, 0, 1);
  ctx.globalAlpha = Math.max(0, Math.min(1, f * 1.6));
  ctx.fillStyle = o.color;
  ctx.beginPath();
  ctx.arc(0, 0, o.size * (0.5 + 0.5 * f), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
