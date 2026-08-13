import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { World } from '../src/core/ecs/World';
import type { LevelDef } from '../src/game/content';
import type { GameEvents } from '../src/game/events';
import { makePlant, makeProjectile, makeZombie } from '../src/game/factory';
import { setupWorld } from '../src/game/setup';
import type { GameState } from '../src/game/state';

const DT = 1 / 60;

function run(world: World, seconds: number): void {
  const steps = Math.floor(seconds / DT);
  for (let i = 0; i < steps; i++) world.update(DT);
}

function stateOf(world: World): GameState {
  return world.resources.state as GameState;
}

const ALLOWED = ['sunflower', 'peashooter', 'snowpea', 'wallnut', 'cherrybomb'] as const;

/** No zombies spawn during the test window (far-future spawn keeps the schedule open). */
const noZombieLevel: LevelDef = {
  id: 'test-empty',
  name: 'test',
  initialSun: 9999,
  startDelay: 0,
  skySun: { first: 9999, min: 9999, max: 9999 },
  allowedPlants: [...ALLOWED],
  waves: [{ zombies: [{ kind: 'basic', at: 9999 }], gap: 0 }],
};

/** One basic zombie spawns immediately at t=0. */
const oneZombieLevel: LevelDef = {
  id: 'test-one',
  name: 'test',
  initialSun: 9999,
  startDelay: 0,
  skySun: { first: 9999, min: 9999, max: 9999 },
  allowedPlants: [...ALLOWED],
  waves: [{ zombies: [{ kind: 'basic', at: 0 }], gap: 0 }],
};

function makeBus(): EventBus<GameEvents> {
  return new EventBus<GameEvents>();
}

describe('wave schedule', () => {
  it('flattens waves into a sorted absolute-time schedule', async () => {
    const { LEVELS } = await import('../src/game/content');
    const setup = setupWorld(LEVELS[0]!, 42, makeBus());
    const expectedTotal = LEVELS[0]!.waves.reduce((n, w) => n + w.zombies.length, 0);
    expect(setup.schedule.length).toBe(expectedTotal);
    for (let i = 1; i < setup.schedule.length; i++) {
      expect(setup.schedule[i]!.at).toBeGreaterThanOrEqual(setup.schedule[i - 1]!.at);
    }
    expect(setup.waveTimes[0]).toBe(LEVELS[0]!.startDelay);
    expect(setup.totalTime).toBeGreaterThan(setup.schedule[setup.schedule.length - 1]!.at);
  });
});

describe('combat simulation', () => {
  it('a zombie with no defense reaches the house and loses the level', () => {
    const setup = setupWorld(oneZombieLevel, 7, makeBus());
    const world = setup.world;
    run(world, 0.1); // let the zombie spawn
    const zombies = world.query('ZombieInfo');
    expect(zombies.length).toBe(1);
    // Sabotage the mower so the zombie can actually reach the house.
    const row = world.get<{ row: number }>(zombies[0]!, 'ZombieBrain')!.row;
    (world.resources.mowers as (number | null)[])[row] = null;
    run(world, 60);
    expect(stateOf(world).phase).toBe('lost');
  });

  it('peashooters in every row defeat a basic zombie', () => {
    const setup = setupWorld(oneZombieLevel, 7, makeBus());
    const world = setup.world;
    for (let row = 0; row < 5; row++) {
      setup.grid[1]![row] = makePlant(world, 'peashooter', 1, row);
    }
    run(world, 60);
    expect(stateOf(world).phase).toBe('won');
    expect(stateOf(world).kills).toBe(1);
  });

  it('frozen projectiles slow zombies to half speed', () => {
    const setup = setupWorld(noZombieLevel, 3, makeBus());
    const world = setup.world;
    const z = makeZombie(world, 'basic', 2, setup.rng);
    const zp = world.get<{ x: number; y: number }>(z, 'Position')!;
    zp.x = 400; // place well inside the lawn so the projectile is not culled
    makeProjectile(world, 'frozen', 2, zp.x + 5, zp.y);
    run(world, 0.2); // projectile connects
    const brain = world.get<{ slowUntil: number }>(z, 'ZombieBrain')!;
    expect(brain.slowUntil).toBeGreaterThan(0.1);
    const xBefore = world.get<{ x: number }>(z, 'Position')!.x;
    run(world, 1);
    const xAfter = world.get<{ x: number }>(z, 'Position')!.x;
    const traveled = xBefore - xAfter;
    expect(traveled).toBeGreaterThan(4); // moved
    expect(traveled).toBeLessThan(12); // but at ~half of the base 16 px/s
  });

  it('cherry bomb explodes and kills a nearby zombie', () => {
    const setup = setupWorld(noZombieLevel, 3, makeBus());
    const world = setup.world;
    setup.grid[2]![2] = makePlant(world, 'cherrybomb', 2, 2);
    const z = makeZombie(world, 'basic', 2, setup.rng);
    world.get<{ x: number }>(z, 'Position')!.x = 260; // right next to cell (2,2)
    run(world, 2.5);
    expect(world.query('ZombieInfo').length).toBe(0);
    expect(setup.grid[2]![2]).toBeNull();
    expect(stateOf(world).kills).toBe(1);
  });

  it('a mower triggers, kills its row, and leaves the board', () => {
    const setup = setupWorld(oneZombieLevel, 7, makeBus());
    const world = setup.world;
    run(world, 0.1);
    const z = world.query('ZombieInfo')[0]!;
    const row = world.get<{ row: number }>(z, 'ZombieBrain')!.row;
    run(world, 60);
    expect(stateOf(world).kills).toBe(1);
    expect(stateOf(world).phase).toBe('won');
    expect((world.resources.mowers as (number | null)[])[row]).toBeNull();
  });

  it('zombies eat plants at their bite DPS', () => {
    const setup = setupWorld(noZombieLevel, 3, makeBus());
    const world = setup.world;
    setup.grid[0]![1] = makePlant(world, 'wallnut', 0, 1);
    const z = makeZombie(world, 'basic', 1, setup.rng);
    world.get<{ x: number }>(z, 'Position')!.x = 55; // just right of the wall-nut center (40)
    run(world, 2);
    const hp = world.get<{ hp: number; max: number }>(setup.grid[0]![1]!, 'Health')!;
    // 2 s at 100 dps = 200 damage off 4000
    expect(hp.max - hp.hp).toBeGreaterThanOrEqual(180);
    expect(hp.max - hp.hp).toBeLessThanOrEqual(220);
  });

  it('sunflowers produce a 25-sun pickup', () => {
    const setup = setupWorld(noZombieLevel, 3, makeBus());
    const world = setup.world;
    makePlant(world, 'sunflower', 0, 0);
    run(world, 25);
    const suns = world
      .query('SunC')
      .map((e) => world.get<{ value: number }>(e, 'SunC')!.value);
    expect(suns).toContain(25);
  });
});

describe('determinism', () => {
  it('same seed produces the same spawn rows', () => {
    const a = setupWorld(oneZombieLevel, 123, makeBus());
    const b = setupWorld(oneZombieLevel, 123, makeBus());
    run(a.world, 0.1);
    run(b.world, 0.1);
    const rowsOf = (w: World) =>
      w
        .query('ZombieInfo')
        .map((e) => w.get<{ row: number }>(e, 'ZombieBrain')!.row);
    expect(rowsOf(a.world)).toEqual(rowsOf(b.world));
  });
});
