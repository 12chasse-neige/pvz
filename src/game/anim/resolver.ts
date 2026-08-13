/**
 * Animation-state resolver: reads existing ECS data and maps it to a
 * sprite + clip + speed + scale, without coupling rendering back into the
 * simulation. Ranged-attack timestamps drive fire/recoil, zombie brain
 * state selects walk/eat, slow state reduces animation speed, and so on.
 */
import type { Entity, World } from '../../core/ecs/World';
import type { MowerC, RangedAttack, Renderable, ZombieBrain, ZombieInfo } from '../components';

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

export function resolvePlay(world: World, e: Entity): SpritePlay | null {
  const r = world.get<Renderable>(e, 'Renderable');
  if (!r) return null;
  const t = world.resources.time as number;
  switch (r.kind) {
    case 'peashooter':
    case 'snowpea': {
      const atk = world.get<RangedAttack>(e, 'RangedAttack');
      const firing = atk ? t - atk.lastShot < FIRE_WINDOW : false;
      return { sprite: r.kind, clip: firing ? 'fire' : 'idle', speed: 1, scale: 1, flipX: false };
    }
    case 'zombie': {
      const b = world.get<ZombieBrain>(e, 'ZombieBrain');
      const zi = world.get<ZombieInfo>(e, 'ZombieInfo');
      // Only the basic zombie is baked so far; armored variants keep the
      // procedural painter until their atlases exist.
      if (zi && zi.kind !== 'basic') return null;
      const slowed = b ? t < b.slowUntil : false;
      const speed = slowed ? 0.55 : 1;
      if (b?.eating) return { sprite: 'zombie-basic', clip: 'eat', speed, scale: 0.66, flipX: false };
      return { sprite: 'zombie-basic', clip: 'walk', speed, scale: 0.66, flipX: false };
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
    // Not yet baked into atlases — these resolve to sprite keys that only
    // exist as procedural fallback painters.
    case 'sunflower':
    case 'wallnut':
    case 'cherrybomb':
      return { sprite: r.kind, clip: 'idle', speed: 1, scale: 1, flipX: false };
    default:
      return null;
  }
}
