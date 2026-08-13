import type { EventBus } from '../core/EventBus';
import type { Entity } from '../core/ecs/World';
import { World } from '../core/ecs/World';
import { Rng } from '../core/Rng';
import { GRID } from './config';
import type { FxState } from './components';
import type { GameEvents } from './events';
import { makeMower } from './factory';
import { registerSystems } from './systems';
import type { GameState, ScheduledSpawn } from './state';
import { createState } from './state';
import type { LevelDef } from './content';

export interface WorldSetup {
  world: World;
  rng: Rng;
  state: GameState;
  /** Flattened, time-sorted spawn schedule. */
  schedule: ScheduledSpawn[];
  /** Absolute start time of each wave (progress bar markers). */
  waveTimes: number[];
  /** Time of the final spawn + margin (progress bar full). */
  totalTime: number;
  grid: (Entity | null)[][];
}

/**
 * Build a fully configured simulation world for a level.
 * Used by GameScene (live play) and by tests (headless, deterministic via
 * the seed). Systems never touch DOM/canvas, so this runs anywhere.
 */
export function setupWorld(level: LevelDef, seed: number, events: EventBus<GameEvents>): WorldSetup {
  const world = new World();
  const rng = new Rng(seed);
  const state = createState(level);
  const grid: (Entity | null)[][] = Array.from({ length: GRID.cols }, () =>
    Array<Entity | null>(GRID.rows).fill(null),
  );

  // Flatten the wave schedule into absolute times.
  const schedule: ScheduledSpawn[] = [];
  const waveTimes: number[] = [];
  let t = level.startDelay;
  let maxEnd = t;
  level.waves.forEach((wave, waveIndex) => {
    waveTimes.push(t);
    for (const z of wave.zombies) {
      schedule.push({ kind: z.kind, at: t + z.at, wave: waveIndex });
      maxEnd = Math.max(maxEnd, t + z.at);
    }
    const lastAt = wave.zombies.reduce((m, z) => Math.max(m, z.at), 0);
    t += lastAt + wave.gap;
  });
  schedule.sort((a, b) => a.at - b.at);
  const totalTime = maxEnd + 2;

  const resources = world.resources;
  resources.rng = rng;
  resources.state = state;
  resources.level = level;
  resources.events = events;
  resources.schedule = schedule;
  resources.scheduleIndex = 0;
  resources.waveTimes = waveTimes;
  resources.totalTime = totalTime;
  resources.grid = grid;
  resources.time = 0;
  resources.nextSkyAt = level.skySun.first;
  resources.fx = { shake: 0, floaters: [] } satisfies FxState;
  resources.zombiesByRow = Array.from({ length: GRID.rows }, () => [] as Entity[]);
  resources.mowers = Array.from({ length: GRID.rows }, () => null as Entity | null);

  for (let row = 0; row < GRID.rows; row++) {
    (resources.mowers as (Entity | null)[])[row] = makeMower(world, row);
  }

  registerSystems(world);
  return { world, rng, state, schedule, waveTimes, totalTime, grid };
}
