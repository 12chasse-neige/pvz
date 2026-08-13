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
    if (rc.quality.shadows && groundY > 0) {
      rc.battlefield.contactShadow(ctx, 0, groundY - 1, shadowWidth(r.kind), 0.26);
    }
    const frame = rc.animator.frameOf(e);
    drawSpriteFrame(ctx, rc.assets, play.sprite, frame, 0, groundY, {
      scale: play.scale,
      flipX: play.flipX,
    });
    if (r.kind === 'zombie') applyZombieOverlays(ctx, rc, world, e, groundY);
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

/** Hit flash + slow tint overlays for baked zombie sprites. */
function applyZombieOverlays(
  ctx: CanvasRenderingContext2D,
  rc: RenderCtx,
  world: World,
  e: Entity,
  groundY: number,
): void {
  const h = world.get<Health>(e, 'Health');
  const b = world.get<ZombieBrain>(e, 'ZombieBrain');
  const t = world.resources.time as number;
  if (b && t < b.slowUntil) {
    // readable slow tint + ice rim (speed change is the primary signal)
    ctx.fillStyle = 'rgba(159,216,255,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, groundY - 44, 17, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(207,234,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, groundY - 46, 9, Math.PI * 0.95, Math.PI * 1.55);
    ctx.stroke();
  }
  if (h && h.flash > 0) {
    ctx.globalAlpha = Math.min(0.6, h.flash * 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, groundY - 44, 15, 22, 0, 0, Math.PI * 2);
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
