import type { EventBus } from '../core/EventBus';
import type { Entity, World } from '../core/ecs/World';
import type { Rng } from '../core/Rng';
import {
  CELL_W,
  GRID,
  HOUSE_X,
  LAWN_H,
  LAWN_LEFT,
  LAWN_TOP,
  LAWN_W,
  MOWER_X,
  cellCenterX,
  cellCenterY,
  zombieCell,
} from './config';
import type { Fuse, FxState, Health, MowerC, Particle, PlantInfo, Position, Producer, ProjectileC, RangedAttack, SunC, ZombieBrain, ZombieInfo } from './components';
import type { GameEvents, LevelStats } from './events';
import { burst, makeProjectile, makeSun, makeZombie } from './factory';
import { snapshotHistory } from './render/history';
import type { GameState } from './state';
import type { LevelDef, PlantKind } from './content';
import type { ScheduledSpawn } from './state';

const now = (world: World): number => world.resources.time as number;
const state = (world: World): GameState => world.resources.state as GameState;
const events = (world: World): EventBus<GameEvents> => world.resources.events as EventBus<GameEvents>;
const rng = (world: World): Rng => world.resources.rng as Rng;
const grid = (world: World): (Entity | null)[][] => world.resources.grid as (Entity | null)[][];
const fx = (world: World): FxState => world.resources.fx as FxState;

function buildStats(st: GameState): LevelStats {
  return { kills: st.kills, sun: st.sunCollected, time: Math.round(st.elapsed) };
}

/** Snapshot render history BEFORE any movement runs (cosmetic only). */
function sysSnapshot(world: World): void {
  snapshotHistory(world);
}

/** Advance the clock, recharge timers, decay shake/floaters, phase prepare->play. */
function sysClock(world: World, dt: number): void {
  world.resources.time = now(world) + dt;
  const st = state(world);
  const level = world.resources.level as LevelDef;
  if (st.phase === 'prepare' && now(world) >= level.startDelay) st.phase = 'play';
  st.elapsed += dt;
  for (const k of Object.keys(st.recharges) as PlantKind[]) {
    if (st.recharges[k] > 0) st.recharges[k] = Math.max(0, st.recharges[k] - dt);
  }
  const f = fx(world);
  f.shake = Math.max(0, f.shake - dt * 2.2);
  for (const fl of f.floaters) {
    fl.ttl -= dt;
    fl.y -= 26 * dt;
  }
  f.floaters = f.floaters.filter((fl) => fl.ttl > 0);
}

/** Rebuild per-row zombie buckets (cheap O(n) each frame). */
function sysIndex(world: World): void {
  const buckets = world.resources.zombiesByRow as Entity[][];
  for (const row of buckets) row.length = 0;
  for (const e of world.query('ZombieBrain')) {
    const b = world.get<ZombieBrain>(e, 'ZombieBrain');
    if (b) buckets[b.row]?.push(e);
  }
}

/** Spawn schedule, wave banners, victory detection. */
function sysWave(world: World): void {
  const st = state(world);
  if (st.phase !== 'play') return;
  const level = world.resources.level as LevelDef;
  const schedule = world.resources.schedule as ScheduledSpawn[];
  let idx = world.resources.scheduleIndex as number;
  const t = now(world);
  while (idx < schedule.length && schedule[idx]!.at <= t) {
    const s = schedule[idx]!;
    const row = pickSpawnRow(world);
    makeZombie(world, s.kind, row, rng(world));
    if (s.wave !== st.waveIndex) {
      st.waveIndex = s.wave;
      const wave = level.waves[s.wave];
      events(world).emit('wave-started', { index: s.wave, flag: wave?.flag ?? false });
    }
    idx++;
  }
  world.resources.scheduleIndex = idx;
  if (idx >= schedule.length && world.query('ZombieInfo').length === 0) {
    st.phase = 'won';
    events(world).emit('level-won', { levelId: level.id, stats: buildStats(st) });
  }
}

function pickSpawnRow(world: World): number {
  const buckets = world.resources.zombiesByRow as Entity[][];
  const r = rng(world);
  const rows = Array.from({ length: GRID.rows }, (_, i) => i);
  return r.pickWeighted(rows, (row) => 1 / (buckets[row]!.length + 1));
}

/** Sky sun timer, sun falling/despawn. Sunflower production lives in sysPlants. */
function sysSun(world: World, dt: number): void {
  const st = state(world);
  const level = world.resources.level as LevelDef;
  const t = now(world);
  if (world.resources.nextSkyAt === undefined) world.resources.nextSkyAt = level.skySun.first;
  if (st.phase === 'play' && t >= (world.resources.nextSkyAt as number)) {
    const x = LAWN_LEFT + rng(world).range(70, LAWN_W - 70);
    const targetY = LAWN_TOP + rng(world).range(40, LAWN_H - 40);
    makeSun(world, x, targetY, 25);
    world.resources.nextSkyAt = t + rng(world).range(level.skySun.min, level.skySun.max);
  }
  for (const e of world.query('SunC')) {
    const s = world.get<SunC>(e, 'SunC')!;
    const p = world.get<Position>(e, 'Position')!;
    s.ttl -= dt;
    s.bob += dt;
    if (s.falling) {
      p.y += s.vy * dt;
      if (p.y >= s.targetY) {
        p.y = s.targetY;
        s.falling = false;
      }
    }
    if (s.ttl <= 0) world.destroy(e);
  }
}

/** Plant behaviors: production, shooting, bomb fuses. */
function sysPlants(world: World, dt: number): void {
  const t = now(world);
  const buckets = world.resources.zombiesByRow as Entity[][];
  for (const e of world.query('RangedAttack')) {
    const atk = world.get<RangedAttack>(e, 'RangedAttack')!;
    const p = world.get<Position>(e, 'Position')!;
    const info = world.get<PlantInfo>(e, 'PlantInfo')!;
    atk.cooldown -= dt;
    if (atk.cooldown > 0) continue;
    const rowZombies = buckets[info.row]!;
    const hasTarget = rowZombies.some((z) => {
      const zp = world.get<Position>(z, 'Position');
      return !!zp && zp.x > p.x - 24;
    });
    if (hasTarget) {
      atk.cooldown = atk.interval;
      atk.lastShot = t;
      makeProjectile(world, atk.kind, info.row, p.x + 16, cellCenterY(info.row) - 16);
      events(world).emit('projectile-fired', { kind: atk.kind });
    } else {
      atk.cooldown = Math.min(atk.cooldown + dt, atk.interval);
    }
  }
  for (const e of world.query('Producer')) {
    const prod = world.get<Producer>(e, 'Producer')!;
    const p = world.get<Position>(e, 'Position')!;
    const info = world.get<PlantInfo>(e, 'PlantInfo')!;
    prod.cooldown -= dt;
    if (prod.cooldown <= 0) {
      prod.cooldown = prod.interval;
      prod.lastProduce = t;
      makeSun(world, p.x + rng(world).range(-14, 14), cellCenterY(info.row) - 18, prod.value);
    }
  }
  for (const e of world.query('Fuse')) {
    const f = world.get<Fuse>(e, 'Fuse')!;
    f.time -= dt;
    if (f.time <= 0) explode(world, e, f);
  }
}

function explode(world: World, bomb: Entity, fuse: Fuse): void {
  const info = world.get<PlantInfo>(bomb, 'PlantInfo')!;
  const cx = cellCenterX(info.col);
  const cy = cellCenterY(info.row);
  const range = (fuse.radius + 0.5) * CELL_W;
  for (const z of world.query('ZombieBrain', 'Position')) {
    const zp = world.get<Position>(z, 'Position')!;
    if (Math.abs(zp.x - cx) <= range && Math.abs(zp.y - cy) <= range) {
      world.get<Health>(z, 'Health')!.hp -= fuse.dmg;
    }
  }
  grid(world)[info.col]![info.row] = null;
  burst(world, cx, cy, '#ff8844', 26, 230);
  burst(world, cx, cy, '#ffe14d', 14, 160);
  fx(world).shake = Math.max(fx(world).shake, 0.45);
  events(world).emit('explosion', { x: cx, y: cy });
  world.destroy(bomb);
}

/** Zombie AI: walk, eat plants, trigger mowers. */
function sysZombies(world: World, dt: number): void {
  const t = now(world);
  const g = grid(world);
  const mowers = world.resources.mowers as (Entity | null)[];
  for (const e of world.query('ZombieBrain')) {
    const b = world.get<ZombieBrain>(e, 'ZombieBrain')!;
    const p = world.get<Position>(e, 'Position')!;
    const slowed = t < b.slowUntil;
    const speed = b.baseSpeed * (slowed ? 0.5 : 1);
    if (b.eating) {
      if (!b.target || !world.alive(b.target)) {
        b.eating = false;
        b.target = null;
      } else {
        const thp = world.get<Health>(b.target, 'Health');
        if (thp) {
          thp.hp -= b.biteDps * dt;
          thp.flash = 0.12;
        }
        continue;
      }
    }
    p.x -= speed * dt;
    const col = zombieCell(p.x);
    const occupant = col >= 0 && col < GRID.cols ? g[col]![b.row]! : null;
    if (occupant && p.x <= cellCenterX(col) + 10) {
      b.eating = true;
      b.target = occupant;
      continue;
    }
    if (p.x < MOWER_X + 14) {
      const m = mowers[b.row]!;
      if (m) {
        const mc = world.get<MowerC>(m, 'MowerC')!;
        if (!mc.active) {
          mc.active = true;
          events(world).emit('mower-triggered', { row: b.row });
        }
      }
    }
  }
}

/** Projectile motion and same-row hit detection. */
function sysProjectiles(world: World, dt: number): void {
  const buckets = world.resources.zombiesByRow as Entity[][];
  const t = now(world);
  for (const e of world.query('ProjectileC')) {
    const pr = world.get<ProjectileC>(e, 'ProjectileC')!;
    const p = world.get<Position>(e, 'Position')!;
    p.x += pr.speed * dt;
    if (p.x > LAWN_LEFT + LAWN_W + 24) {
      world.destroy(e);
      continue;
    }
    for (const z of buckets[pr.row]!) {
      if (!world.alive(z)) continue;
      const zp = world.get<Position>(z, 'Position');
      if (!zp) continue;
      if (p.x >= zp.x - 12 && p.x <= zp.x + 30 && Math.abs(p.y - zp.y) < 36) {
        const zhp = world.get<Health>(z, 'Health')!;
        zhp.hp -= pr.dmg;
        zhp.flash = 0.1;
        if (pr.kind === 'frozen') {
          const zb = world.get<ZombieBrain>(z, 'ZombieBrain')!;
          zb.slowUntil = Math.max(zb.slowUntil, t + pr.slowDur);
        }
        burst(world, p.x, p.y, pr.kind === 'frozen' ? '#9fdcff' : '#a8e860', 4, 70);
        events(world).emit('projectile-hit', { kind: pr.kind, x: p.x, y: p.y });
        world.destroy(e);
        break;
      }
    }
  }
}

/** Mower sweep: activates on trigger, kills zombies in its row, exits right. */
function sysMowers(world: World, dt: number): void {
  const buckets = world.resources.zombiesByRow as Entity[][];
  const mowers = world.resources.mowers as (Entity | null)[];
  for (const e of world.query('MowerC')) {
    const m = world.get<MowerC>(e, 'MowerC')!;
    const p = world.get<Position>(e, 'Position')!;
    if (!m.active) continue;
    p.x += m.speed * dt;
    m.dustAcc += dt;
    if (m.dustAcc > 0.05) {
      m.dustAcc = 0;
      burst(world, p.x - 24, p.y, '#b8b0a0', 2, 50);
    }
    for (const z of [...buckets[m.row]!]) {
      if (!world.alive(z)) continue;
      const zp = world.get<Position>(z, 'Position');
      if (!zp) continue;
      if (zp.x < p.x + 42) {
        world.get<Health>(z, 'Health')!.hp = 0;
      }
    }
    if (p.x > LAWN_LEFT + LAWN_W + 80) {
      mowers[m.row] = null;
      world.destroy(e);
    }
  }
}

/** Particle motion and expiry. */
function sysParticles(world: World, dt: number): void {
  for (const e of world.query('Particle')) {
    const pt = world.get<Particle>(e, 'Particle')!;
    const p = world.get<Position>(e, 'Position')!;
    pt.ttl -= dt;
    if (pt.ttl <= 0) {
      world.destroy(e);
      continue;
    }
    pt.vy += pt.gravity * dt;
    p.x += pt.vx * dt;
    p.y += pt.vy * dt;
  }
}

/** Kill anything at <= 0 hp: plants clear their grid cell, zombies count. */
function sysHealth(world: World, dt: number): void {
  const g = grid(world);
  const st = state(world);
  for (const e of world.query('Health')) {
    const h = world.get<Health>(e, 'Health')!;
    if (h.flash > 0) h.flash = Math.max(0, h.flash - dt);
    if (h.hp > 0) continue;
    const info = world.get<PlantInfo>(e, 'PlantInfo');
    if (info) {
      g[info.col]![info.row] = null;
      const pos = world.get<Position>(e, 'Position')!;
      burst(world, pos.x, pos.y, '#7ec850', 8, 100);
      world.destroy(e);
      continue;
    }
    const zi = world.get<ZombieInfo>(e, 'ZombieInfo');
    if (zi) {
      st.kills++;
      const pos = world.get<Position>(e, 'Position')!;
      burst(world, pos.x, pos.y, '#a9bd8c', 10, 110);
      burst(world, pos.x, pos.y - 18, '#6b5646', 6, 90);
      events(world).emit('zombie-killed', { kind: zi.kind, x: pos.x, y: pos.y });
      world.destroy(e);
      continue;
    }
    world.destroy(e);
  }
}

/** Defeat: a zombie reached the house line. */
function sysLose(world: World): void {
  const st = state(world);
  if (st.phase !== 'play') return;
  const level = world.resources.level as LevelDef;
  for (const e of world.query('ZombieBrain')) {
    const p = world.get<Position>(e, 'Position');
    if (p && p.x < HOUSE_X) {
      st.phase = 'lost';
      events(world).emit('level-lost', { levelId: level.id, stats: buildStats(st) });
      return;
    }
  }
}

/** Register every system in execution order. */
export function registerSystems(world: World): void {
  world.addSystem('snapshot', sysSnapshot);
  world.addSystem('clock', sysClock);
  world.addSystem('index', sysIndex);
  world.addSystem('wave', sysWave);
  world.addSystem('sun', sysSun);
  world.addSystem('plants', sysPlants);
  world.addSystem('zombies', sysZombies);
  world.addSystem('projectiles', sysProjectiles);
  world.addSystem('mowers', sysMowers);
  world.addSystem('particles', sysParticles);
  world.addSystem('health', sysHealth);
  world.addSystem('lose', sysLose);
}

