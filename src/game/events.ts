import type { PlantKind, ZombieKind } from './content';

export interface LevelStats {
  kills: number;
  sun: number;
  time: number;
}

/** Typed domain events emitted by the simulation, consumed by UI/audio/effects. */
export interface GameEvents {
  'sun-collected': { value: number; total: number };
  'sun-spawned': { source: 'sky' | 'sunflower' };
  'plant-placed': { kind: PlantKind; col: number; row: number };
  'plant-removed': { col: number; row: number };
  'projectile-fired': { kind: 'pea' | 'frozen' };
  'projectile-hit': { kind: 'pea' | 'frozen'; x: number; y: number };
  'zombie-killed': { kind: ZombieKind; x: number; y: number };
  'explosion': { x: number; y: number };
  'mower-triggered': { row: number };
  'wave-started': { index: number; flag: boolean };
  'level-won': { levelId: string; stats: LevelStats };
  'level-lost': { levelId: string; stats: LevelStats };
}
