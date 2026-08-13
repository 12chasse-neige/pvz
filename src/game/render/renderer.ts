/**
 * Entity renderer: reads ECS state, resolves animation, and paints either
 * a sprite frame from the atlas (with contact shadow + status overlays) or
 * a procedural fallback painter when the asset is missing.
 */
import type { AssetManager } from '../../core/AssetManager';
import type { Entity, World } from '../../core/ecs/World';
import type { RenderProfile } from '../anim/types';
import type { MarkerEvent } from '../anim/playback';
import type { Animator } from '../anim/playback';
import { resolvePlay } from '../anim/resolver';
import type { Health, Particle, Position, Renderable, ZombieBrain } from '../components';
import { interpPos } from './history';
import { drawSpriteFrame } from './sprites';
import type { CosmeticFx } from './fx';
import type { Battlefield, LightingState } from './battlefield';
import {
  paintCherry,
  paintMower,
  paintParticle,
  paintPea,
  paintPeashooter,
  paintSunEntity,
  paintSunflower,
  paintWallnut,
  paintZombie,
} from './painters';
import { ZOMBIES } from '../content';
import { clamp } from '../../core/math';

export interface RenderCtx {
  ctx: CanvasRenderingContext2D;
  assets: AssetManager;
  animator: Animator;
  fx: CosmeticFx;
  battlefield: Battlefield;
  quality: RenderProfile;
  lighting: LightingState;
  alpha: number;
}

/** Vertical distance from an entity's Position.y to its ground contact. */
const GROUND_OFFSETS: Record<string, number> = {
  sunflower: 26,
  peashooter: 26,
  snowpea: 26,
  wallnut: 26,
  cherrybomb: 26,
  zombie: 40,
  mower: 30,
};

/** Contact-shadow width per kind (logical px). */
function shadowWidth(kind: string): number {
  if (kind === 'zombie') return 40;
  if (kind === 'mower') return 56;
  if (kind === 'sun') return 22;
  return 34;
}

const tmp = { x: 0, y: 0 };

export function paintEntity(rc: RenderCtx, world: World, e: Entity): void {
  const r = world.get<Renderable>(e, 'Renderable');
  const p = world.get<Position>(e, 'Position');
  if (!r || !p) return;
  interpPos(world, e, rc.alpha, tmp);
  const ctx = rc.ctx;

  if (r.kind === 'particle') {
    const pt = world.get<Particle>(e, 'Particle');
    if (!pt) return;
    ctx.save();
    ctx.translate(tmp.x, tmp.y);
    paintParticle(ctx, { ttlFrac: clamp(pt.ttl / pt.maxTtl, 0, 1), color: pt.color, size: pt.size });
    ctx.restore();
    return;
  }

  const play = resolvePlay(world, e);
  const groundY = GROUND_OFFSETS[r.kind] ?? 0;
  ctx.save();
  ctx.translate(tmp.x, tmp.y);

  if (play && rc.assets.getSprite(play.sprite)) {
    // motion streaks behind projectiles
    if ((r.kind === 'pea' || r.kind === 'pea-frozen') && rc.quality.streaks) {
      const frozen = r.kind === 'pea-frozen';
      ctx.strokeStyle = frozen ? 'rgba(160,225,255,0.5)' : 'rgba(150,230,110,0.4)';
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 3 - i;
        ctx.globalAlpha = 0.4 - i * 0.11;
        ctx.beginPath();
        ctx.moveTo(-8 - i * 7, 0);
        ctx.lineTo(-20 - i * 8, 0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (rc.quality.shadows && groundY > 0) {
      rc.battlefield.contactShadow(ctx, 0, groundY - 1, shadowWidth(r.kind), 0.26);
    }
    const frame = rc.animator.frameOf(e);
    drawSpriteFrame(ctx, rc.assets, play.sprite, frame, 0, groundY, {
      scale: play.scale,
      flipX: play.flipX,
    });
    if (r.kind === 'peashooter' || r.kind === 'snowpea') {
      applyPlantOverlays(ctx, rc, world, e, groundY, frame);
    }
    if (r.kind === 'zombie') applyZombieOverlays(ctx, rc, world, e, groundY, play.scale);
    if (r.kind === 'snowpea' && rc.quality.ambient) {
      // drifting cold vapor (deterministic per entity)
      const t = world.resources.time as number;
      const ph = ((e * 0.61803398875) % 1);
      for (let i = 0; i < 2; i++) {
        const cyc = (t * 0.42 + ph + i * 0.5) % 1;
        const vx = -10 + Math.sin(t * 1.1 + ph * 6.28 + i * 2.4) * 6;
        const vy = -26 - cyc * 26;
        ctx.globalAlpha = 0.26 * (1 - cyc);
        ctx.fillStyle = '#eef8ff';
        ctx.beginPath();
        ctx.arc(vx, vy, 2.4 + cyc * 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    return;
  }

  // ---- procedural fallbacks (missing atlas or unbaked character) ----
  const t = world.resources.time as number;
  switch (r.kind) {
    case 'sunflower': {
      const prod = world.get<{ cooldown: number; interval: number }>(e, 'Producer');
      const remaining = prod ? prod.cooldown / prod.interval : 1;
      const glow = remaining < 0.25 ? (0.25 - remaining) / 0.25 : 0;
      paintSunflower(ctx, t + r.anim, { glow });
      break;
    }
    case 'peashooter':
    case 'snowpea': {
      const atk = world.get<{ lastShot: number }>(e, 'RangedAttack');
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
      const f = world.get<{ time: number; maxTime: number }>(e, 'Fuse');
      paintCherry(ctx, t + r.anim, { frac: f ? clamp(f.time / f.maxTime, 0, 1) : 1 });
      break;
    }
    case 'zombie': {
      const zi = world.get<{ kind: keyof typeof ZOMBIES }>(e, 'ZombieInfo');
      const b = world.get<ZombieBrain>(e, 'ZombieBrain');
      const h = world.get<Health>(e, 'Health');
      const def = ZOMBIES[zi?.kind ?? 'basic'];
      paintZombie(ctx, t + r.anim, {
        eating: b?.eating ?? false,
        slowed: b ? t < b.slowUntil : false,
        flash: h?.flash ?? 0,
        accessory: def.accessory,
        runner: zi?.kind === 'runner',
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
      const m = world.get<{ active: boolean }>(e, 'MowerC');
      paintMower(ctx, m?.active ? t : 0);
      break;
    }
  }
  ctx.restore();
}

/**
 * Peashooter/Snow Pea overlays: eye tracking toward the nearest zombie in
 * the row, plus a restrained white hit-flash when the plant is bitten.
 */
function applyPlantOverlays(
  ctx: CanvasRenderingContext2D,
  rc: RenderCtx,
  world: World,
  e: Entity,
  groundY: number,
  frame: number,
): void {
  const h = world.get<Health>(e, 'Health');
  const info = world.get<{ row: number }>(e, 'PlantInfo');
  const p = world.get<Position>(e, 'Position');
  // ---- hit flash (bites) ----
  if (h && h.flash > 0) {
    ctx.globalAlpha = Math.min(0.5, h.flash * 4);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(2, groundY - 20, 20, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // ---- eye tracking (skip the blink frame of the idle clip) ----
  if (frame === 3) return;
  let lookX = 1;
  if (info && p) {
    const buckets = world.resources.zombiesByRow as Entity[][];
    const row = buckets[info.row] ?? [];
    for (const z of row) {
      const zp = world.get<Position>(z, 'Position');
      if (zp && zp.x > p.x - 30) {
        lookX = Math.max(-1.4, Math.min(1.4, (zp.x - p.x) / 90));
        break;
      }
    }
  }
  const ex = 2 + lookX * 1.6;
  const ey = groundY - 14.2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex, ey, 4.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,60,25,0.9)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#1c2c1c';
  ctx.beginPath();
  ctx.arc(ex + lookX * 1.1, ey + 0.2, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(ex + lookX * 1.1 - 0.7, ey - 0.5, 0.7, 0, Math.PI * 2);
  ctx.fill();
  void rc;
}

/** Hit flash + slow tint overlays for baked zombie sprites. */
function applyZombieOverlays(
  ctx: CanvasRenderingContext2D,
  rc: RenderCtx,
  world: World,
  e: Entity,
  groundY: number,
  scale: number,
): void {
  const h = world.get<Health>(e, 'Health');
  const b = world.get<ZombieBrain>(e, 'ZombieBrain');
  const t = world.resources.time as number;
  const headY = groundY - 66 * scale;
  const r = 17 * scale;
  if (b && t < b.slowUntil) {
    // readable slow tint + ice rim (speed change is the primary signal)
    ctx.fillStyle = 'rgba(159,216,255,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, headY + 2, r, r * 1.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(207,234,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, headY, r * 0.62, Math.PI * 0.95, Math.PI * 1.55);
    ctx.stroke();
  }
  if (h && h.flash > 0) {
    ctx.globalAlpha = Math.min(0.6, h.flash * 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, headY + 2, r * 0.95, r * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  void rc;
}

/** Advance sprite animation clocks for every renderable entity. */
export function updateAnimator(
  world: World,
  dt: number,
  animator: Animator,
  assets: AssetManager,
  onMarker: (e: Entity, kind: string, marker: MarkerEvent) => void,
): void {
  for (const e of world.query('Renderable', 'Position')) {
    const play = resolvePlay(world, e);
    if (!play || !assets.getSprite(play.sprite)) {
      animator.remove(e);
      continue;
    }
    const events = animator.advance(e, play.sprite, play.clip, dt, play.speed);
    for (const ev of events) onMarker(e, world.get<Renderable>(e, 'Renderable')?.kind ?? 'unknown', ev);
  }
}
