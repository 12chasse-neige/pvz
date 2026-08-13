import type { Entity } from '../core/ecs/World';
import type { World } from '../core/ecs/World';
import type { Rng } from '../core/Rng';
import { LAWN_LEFT, LAWN_W, MOWER_SPEED, MOWER_X, SUN_TTL, cellCenterX, cellCenterY } from './config';
import type { Particle } from './components';
import { PLANTS, PROJECTILES, ZOMBIES } from './content';
import type { PlantKind, ProjectileKind, ZombieKind } from './content';
import { PREV_POSITION } from './render/history';

/** Adds a Position plus an identically-initialized render history. */
function place(world: World, e: Entity, x: number, y: number): void {
  world.addComponent(e, 'Position', { x, y });
  world.addComponent(e, PREV_POSITION, { x, y });
}

export function makePlant(world: World, kind: PlantKind, col: number, row: number): Entity {
  const def = PLANTS[kind];
  const e = world.spawn();
  place(world, e, cellCenterX(col), cellCenterY(row));
  const rng = world.resources.rng as Rng;
  world.addComponent(e, 'PlantInfo', { kind, col, row });
  world.addComponent(e, 'Health', { hp: def.hp, max: def.hp, flash: 0 });
  world.addComponent(e, 'Renderable', { kind, anim: rng.range(0, 10) });
  if (def.shoots) {
    world.addComponent(e, 'RangedAttack', {
      cooldown: 0.7,
      interval: def.shoots.interval,
      kind: def.shoots.projectile,
      lastShot: -99,
    });
  }
  if (def.produces) {
    world.addComponent(e, 'Producer', {
      cooldown: def.produces.interval,
      interval: def.produces.interval,
      value: def.produces.value,
      lastProduce: -99,
    });
  }
  if (def.bomb) {
    world.addComponent(e, 'Fuse', {
      time: def.bomb.fuse,
      maxTime: def.bomb.fuse,
      radius: def.bomb.radius,
      dmg: def.bomb.dmg,
    });
  }
  return e;
}

export function makeZombie(world: World, kind: ZombieKind, row: number, rng: Rng): Entity {
  const def = ZOMBIES[kind];
  const e = world.spawn();
  place(world, e, LAWN_LEFT + LAWN_W + rng.range(15, 60), cellCenterY(row));
  world.addComponent(e, 'ZombieBrain', {
    row,
    baseSpeed: def.speed,
    slowUntil: 0,
    eating: false,
    target: null,
    biteDps: def.biteDps,
  });
  world.addComponent(e, 'ZombieInfo', { kind });
  world.addComponent(e, 'Health', { hp: def.hp, max: def.hp, flash: 0 });
  world.addComponent(e, 'Renderable', { kind: 'zombie', anim: rng.range(0, 10) });
  return e;
}

export function makeProjectile(
  world: World,
  kind: ProjectileKind,
  row: number,
  x: number,
  y: number,
): Entity {
  const def = PROJECTILES[kind];
  const e = world.spawn();
  place(world, e, x, y);
  world.addComponent(e, 'ProjectileC', {
    dmg: def.dmg,
    speed: def.speed,
    kind,
    slowPct: def.slowPct,
    slowDur: def.slowDur,
    row,
  });
  world.addComponent(e, 'Renderable', { kind: kind === 'frozen' ? 'pea-frozen' : 'pea', anim: 0 });
  return e;
}

export function makeSun(world: World, x: number, targetY: number, value: number): Entity {
  const e = world.spawn();
  place(world, e, x, -24);
  world.addComponent(e, 'SunC', {
    value,
    ttl: SUN_TTL,
    falling: true,
    targetY,
    vy: 85,
    bob: 0,
  });
  world.addComponent(e, 'Renderable', { kind: 'sun', anim: 0 });
  return e;
}

export function makeMower(world: World, row: number): Entity {
  const e = world.spawn();
  place(world, e, MOWER_X, cellCenterY(row) + 14);
  world.addComponent(e, 'MowerC', { row, active: false, speed: MOWER_SPEED, dustAcc: 0 });
  world.addComponent(e, 'Renderable', { kind: 'mower', anim: 0 });
  return e;
}

export function burst(
  world: World,
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number,
): void {
  const r = world.resources.rng as Rng;
  for (let i = 0; i < count; i++) {
    const e = world.spawn();
    const ttl = 0.4 + r.range(0, 0.35);
    place(world, e, x, y);
    world.addComponent(e, 'Particle', {
      ttl,
      maxTtl: ttl,
      color,
      size: r.range(3, 6),
      vx: r.range(-1, 1) * speed,
      vy: r.range(-1, 0.5) * speed,
      gravity: 160,
    } satisfies Particle);
    world.addComponent(e, 'Renderable', { kind: 'particle', anim: 0 });
  }
}

export function spawnFloater(
  world: World,
  x: number,
  y: number,
  text: string,
  color = '#ffe14d',
): void {
  const fx = world.resources.fx as {
    floaters: { x: number; y: number; text: string; color: string; ttl: number; maxTtl: number }[];
  };
  fx.floaters.push({ x, y, text, color, ttl: 1.1, maxTtl: 1.1 });
}
