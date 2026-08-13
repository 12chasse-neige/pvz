/**
 * Data-driven game content. Adding a new plant or zombie means adding a
 * row here (plus optionally a painter in render/painters.ts and an icon
 * entry in render/painters.ts ICON_DRAWERS) - no engine code changes.
 */

export type PlantKind = 'sunflower' | 'peashooter' | 'snowpea' | 'wallnut' | 'cherrybomb';
export type ZombieKind = 'basic' | 'cone' | 'bucket' | 'runner' | 'flag';
export type ProjectileKind = 'pea' | 'frozen';

export interface PlantDef {
  kind: PlantKind;
  name: string;
  cost: number;
  hp: number;
  /** Seed-bank recharge seconds. */
  recharge: number;
  produces?: { interval: number; value: number };
  shoots?: { interval: number; projectile: ProjectileKind };
  bomb?: { fuse: number; radius: number; dmg: number };
}

export const PLANTS: Record<PlantKind, PlantDef> = {
  sunflower: {
    kind: 'sunflower',
    name: 'Sunflower',
    cost: 50,
    hp: 300,
    recharge: 5,
    produces: { interval: 24, value: 25 },
  },
  peashooter: {
    kind: 'peashooter',
    name: 'Peashooter',
    cost: 100,
    hp: 300,
    recharge: 5,
    shoots: { interval: 1.4, projectile: 'pea' },
  },
  snowpea: {
    kind: 'snowpea',
    name: 'Snow Pea',
    cost: 175,
    hp: 300,
    recharge: 5,
    shoots: { interval: 1.4, projectile: 'frozen' },
  },
  wallnut: {
    kind: 'wallnut',
    name: 'Wall-nut',
    cost: 50,
    hp: 4000,
    recharge: 20,
  },
  cherrybomb: {
    kind: 'cherrybomb',
    name: 'Cherry Bomb',
    cost: 150,
    hp: 300,
    recharge: 35,
    bomb: { fuse: 1.2, radius: 1, dmg: 1800 },
  },
};

export type ZombieAccessory = 'none' | 'cone' | 'bucket' | 'flag';

export interface ZombieDef {
  kind: ZombieKind;
  name: string;
  hp: number;
  /** px per second toward the house. */
  speed: number;
  /** Plant hp drained per second while eating. */
  biteDps: number;
  accessory: ZombieAccessory;
}

export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  basic: { kind: 'basic', name: 'Zombie', hp: 200, speed: 16, biteDps: 100, accessory: 'none' },
  flag: { kind: 'flag', name: 'Flag Zombie', hp: 200, speed: 20, biteDps: 100, accessory: 'flag' },
  cone: { kind: 'cone', name: 'Conehead Zombie', hp: 560, speed: 16, biteDps: 100, accessory: 'cone' },
  bucket: { kind: 'bucket', name: 'Buckethead Zombie', hp: 1290, speed: 14, biteDps: 100, accessory: 'bucket' },
  runner: { kind: 'runner', name: 'Runner Zombie', hp: 200, speed: 32, biteDps: 100, accessory: 'none' },
};

export interface ProjectileDef {
  dmg: number;
  speed: number;
  slowPct: number;
  slowDur: number;
}

export const PROJECTILES: Record<ProjectileKind, ProjectileDef> = {
  pea: { dmg: 20, speed: 360, slowPct: 0, slowDur: 0 },
  frozen: { dmg: 20, speed: 360, slowPct: 0.5, slowDur: 4 },
};

export interface ZombieSpawn {
  kind: ZombieKind;
  /** Seconds after this wave starts. */
  at: number;
}

export interface Wave {
  /** Show the "huge wave" banner when this wave starts. */
  flag?: boolean;
  zombies: ZombieSpawn[];
  /** Seconds after the wave's last spawn before the next wave. */
  gap: number;
}

export interface LevelDef {
  id: string;
  name: string;
  initialSun: number;
  /** Seconds before the first wave starts (planting allowed immediately). */
  startDelay: number;
  skySun: { first: number; min: number; max: number };
  waves: Wave[];
  allowedPlants: PlantKind[];
}

export const LEVELS: LevelDef[] = [
  {
    id: 'day-1',
    name: 'Day 1',
    initialSun: 200,
    startDelay: 25,
    skySun: { first: 5, min: 6, max: 10 },
    allowedPlants: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea'],
    waves: [
      { zombies: [{ kind: 'basic', at: 0 }], gap: 12 },
      { zombies: [{ kind: 'basic', at: 0 }, { kind: 'basic', at: 8 }], gap: 14 },
      {
        flag: true,
        zombies: [
          { kind: 'basic', at: 0 },
          { kind: 'basic', at: 6 },
          { kind: 'cone', at: 12 },
        ],
        gap: 16,
      },
      {
        flag: true,
        zombies: [
          { kind: 'basic', at: 0 },
          { kind: 'basic', at: 4 },
          { kind: 'cone', at: 10 },
          { kind: 'basic', at: 16 },
          { kind: 'flag', at: 22 },
        ],
        gap: 0,
      },
    ],
  },
  {
    id: 'day-2',
    name: 'Day 2',
    initialSun: 150,
    startDelay: 14,
    skySun: { first: 5, min: 6, max: 10 },
    allowedPlants: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea'],
    waves: [
      { zombies: [{ kind: 'basic', at: 0 }, { kind: 'basic', at: 6 }], gap: 9 },
      {
        zombies: [
          { kind: 'basic', at: 0 },
          { kind: 'basic', at: 4 },
          { kind: 'cone', at: 10 },
          { kind: 'basic', at: 14 },
        ],
        gap: 12,
      },
      {
        flag: true,
        zombies: [
          { kind: 'basic', at: 0 },
          { kind: 'cone', at: 4 },
          { kind: 'basic', at: 6 },
          { kind: 'bucket', at: 12 },
          { kind: 'basic', at: 16 },
        ],
        gap: 13,
      },
      {
        zombies: [
          { kind: 'cone', at: 0 },
          { kind: 'basic', at: 4 },
          { kind: 'cone', at: 10 },
          { kind: 'basic', at: 16 },
        ],
        gap: 14,
      },
      {
        flag: true,
        zombies: [
          { kind: 'bucket', at: 0 },
          { kind: 'cone', at: 4 },
          { kind: 'basic', at: 8 },
          { kind: 'cone', at: 14 },
          { kind: 'basic', at: 20 },
          { kind: 'flag', at: 26 },
        ],
        gap: 0,
      },
    ],
  },
  {
    id: 'day-3',
    name: 'Day 3',
    initialSun: 100,
    startDelay: 10,
    skySun: { first: 6, min: 8, max: 11 },
    allowedPlants: ['sunflower', 'peashooter', 'wallnut', 'cherrybomb', 'snowpea'],
    waves: [
      { zombies: [{ kind: 'basic', at: 0 }, { kind: 'runner', at: 8 }], gap: 8 },
      {
        zombies: [
          { kind: 'runner', at: 0 },
          { kind: 'basic', at: 4 },
          { kind: 'runner', at: 10 },
          { kind: 'cone', at: 14 },
        ],
        gap: 11,
      },
      {
        flag: true,
        zombies: [
          { kind: 'runner', at: 0 },
          { kind: 'runner', at: 4 },
          { kind: 'basic', at: 8 },
          { kind: 'bucket', at: 12 },
          { kind: 'cone', at: 16 },
        ],
        gap: 12,
      },
      {
        zombies: [
          { kind: 'cone', at: 0 },
          { kind: 'runner', at: 3 },
          { kind: 'bucket', at: 8 },
          { kind: 'runner', at: 14 },
          { kind: 'cone', at: 18 },
          { kind: 'basic', at: 22 },
        ],
        gap: 13,
      },
      {
        flag: true,
        zombies: [
          { kind: 'bucket', at: 0 },
          { kind: 'runner', at: 2 },
          { kind: 'bucket', at: 6 },
          { kind: 'cone', at: 10 },
          { kind: 'runner', at: 14 },
          { kind: 'bucket', at: 18 },
          { kind: 'cone', at: 22 },
          { kind: 'runner', at: 26 },
          { kind: 'flag', at: 30 },
        ],
        gap: 0,
      },
    ],
  },
];

export function levelById(id: string): LevelDef {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error('Unknown level ' + id);
  return l;
}
