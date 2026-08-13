/**
 * Animation-state resolver: reads existing ECS data and maps it to a
 * sprite + clip + speed + scale, without coupling rendering back into the
 * simulation. Ranged-attack timestamps drive fire/recoil, zombie brain
 * state selects walk/eat, health fractions select damage tiers for
 * Wall-nuts and armored zombies, slow state reduces animation speed, hit
 * flash selects the squash response, and the cherry fuse fraction drives
 * urgency.
 */
import type { Entity, World } from '../../core/ecs/World';
import type { Health, MowerC, Producer, RangedAttack, Renderable, ZombieBrain, ZombieInfo } from '../components';
import type { ZombieKind } from '../content';

export interface SpritePlay {
  sprite: string;
  clip: string;
  /** Playback speed multiplier (slowed zombies animate slower). */
  speed: number;
  /** Draw scale relative to the baked logical size. */
  scale: number;
  flipX: boolean;
}

/** Seconds after lastShot during which the fire clip plays. */
const FIRE_WINDOW = 0.26;
/** Seconds before production completes during which the produce clip plays. */
const PRODUCE_WINDOW = 0.35;

/** Per-variant sprite key and draw scale (each baked at its own size). */
export const ZOMBIE_SPRITES: Record<ZombieKind, { sprite: string; scale: number }> = {
  basic: { sprite: 'zombie-basic', scale: 0.86 },
  cone: { sprite: 'zombie-cone', scale: 0.74 },
  bucket: { sprite: 'zombie-bucket', scale: 0.78 },
  runner: { sprite: 'zombie-runner', scale: 0.85 },
  flag: { sprite: 'zombie-flag', scale: 0.71 },
};

function zombieDamageSuffix(kind: ZombieKind, hpFrac: number): '' | '-dmg1' | '-dmg2' {
  if (kind !== 'cone' && kind !== 'bucket') return '';
  if (hpFrac > 0.67) return '';
  return hpFrac > 0.34 ? '-dmg1' : '-dmg2';
}

export function resolvePlay(world: World, e: Entity): SpritePlay | null {
  const r = world.get<Renderable>(e, 'Renderable');
  if (!r) return null;
  const t = world.resources.time as number;
  switch (r.kind) {
    case 'peashooter':
    case 'snowpea': {
      const atk = world.get<RangedAttack>(e, 'RangedAttack');
      const h = world.get<Health>(e, 'Health');
      if (h && h.flash > 0.02) return { sprite: r.kind, clip: 'hit', speed: 1, scale: 1, flipX: false };
      const firing = atk ? t - atk.lastShot < FIRE_WINDOW : false;
      return { sprite: r.kind, clip: firing ? 'fire' : 'idle', speed: 1, scale: 1, flipX: false };
    }
    case 'sunflower': {
      const prod = world.get<Producer>(e, 'Producer');
      const remaining = prod ? prod.cooldown / prod.interval : 1;
      return {
        sprite: 'sunflower',
        clip: remaining < PRODUCE_WINDOW ? 'produce' : 'idle',
        speed: 1,
        scale: 1,
        flipX: false,
      };
    }
    case 'wallnut': {
      const h = world.get<Health>(e, 'Health');
      const hpFrac = h ? h.hp / h.max : 1;
      if (h && h.flash > 0.05) return { sprite: 'wallnut', clip: 'squash', speed: 1, scale: 1, flipX: false };
      const clip = hpFrac > 0.67 ? 'full' : hpFrac > 0.34 ? 'cracked' : 'broken';
      return { sprite: 'wallnut', clip, speed: 1, scale: 1, flipX: false };
    }
    case 'cherrybomb': {
      const f = world.get<{ time: number; maxTime: number }>(e, 'Fuse');
      const frac = f ? Math.max(0, Math.min(1, f.time / f.maxTime)) : 1;
      const urgency = 1 - frac;
      const clip = urgency > 0.66 ? 'preflash' : urgency > 0.3 ? 'urgent' : 'idle';
      return { sprite: 'cherry', clip, speed: 1 + urgency * 1.6, scale: 1, flipX: false };
    }
    case 'zombie': {
      const b = world.get<ZombieBrain>(e, 'ZombieBrain');
      const zi = world.get<ZombieInfo>(e, 'ZombieInfo');
      const h = world.get<Health>(e, 'Health');
      const kind = zi?.kind ?? 'basic';
      const v = ZOMBIE_SPRITES[kind];
      const slowed = b ? t < b.slowUntil : false;
      const speed = slowed ? 0.55 : 1;
      const dmg = zombieDamageSuffix(kind, h ? h.hp / h.max : 1);
      if (b?.eating) return { sprite: v.sprite, clip: 'eat' + dmg, speed, scale: v.scale, flipX: false };
      return { sprite: v.sprite, clip: 'walk' + dmg, speed, scale: v.scale, flipX: false };
    }
    case 'pea':
      return { sprite: 'pea', clip: 'spin', speed: 1, scale: 1, flipX: false };
    case 'pea-frozen':
      return { sprite: 'pea-frozen', clip: 'spin', speed: 1, scale: 1, flipX: false };
    case 'sun':
      return { sprite: 'sun', clip: 'pulse', speed: 1, scale: 1, flipX: false };
    case 'mower': {
      const m = world.get<MowerC>(e, 'MowerC');
      return { sprite: 'mower', clip: m?.active ? 'run' : 'idle', speed: 1, scale: 1, flipX: false };
    }
    default:
      return null;
  }
}
