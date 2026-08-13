import type { Entity } from '../core/ecs/World';
import type { PlantKind, ZombieKind } from './content';

/** Entity components (pure data; systems mutate, renderers read). */

export interface Position {
  x: number;
  y: number;
}

export interface Health {
  hp: number;
  max: number;
  /** Seconds of white hit-flash remaining (drives the renderer). */
  flash: number;
}

export interface PlantInfo {
  kind: PlantKind;
  col: number;
  row: number;
}

export interface RangedAttack {
  cooldown: number;
  interval: number;
  kind: 'pea' | 'frozen';
  /** World time of the last shot (drives muzzle animation). */
  lastShot: number;
}

export interface Producer {
  cooldown: number;
  interval: number;
  value: number;
  /** World time of the last production (drives glow animation). */
  lastProduce: number;
}

export interface ProjectileC {
  dmg: number;
  speed: number;
  kind: 'pea' | 'frozen';
  slowPct: number;
  slowDur: number;
  row: number;
}

export interface ZombieBrain {
  row: number;
  baseSpeed: number;
  /** World time until which the zombie is slowed (0 = not slowed). */
  slowUntil: number;
  eating: boolean;
  target: Entity | null;
  biteDps: number;
}

export interface ZombieInfo {
  kind: ZombieKind;
}

export interface Fuse {
  time: number;
  maxTime: number;
  /** Explosion reach in cells from the bomb's cell (1 = classic 3x3). */
  radius: number;
  dmg: number;
}

export interface SunC {
  value: number;
  ttl: number;
  falling: boolean;
  targetY: number;
  vy: number;
  bob: number;
}

export interface MowerC {
  row: number;
  active: boolean;
  speed: number;
  dustAcc: number;
}

export interface Renderable {
  kind: string;
  /** Cosmetic animation clock, seconds. */
  anim: number;
}

export interface Particle {
  ttl: number;
  maxTtl: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  gravity: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  ttl: number;
  maxTtl: number;
}

export interface FxState {
  /** Screen shake magnitude (decays). */
  shake: number;
  floaters: Floater[];
}
