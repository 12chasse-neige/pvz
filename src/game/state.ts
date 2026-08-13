import type { LevelDef, PlantKind } from './content';
import { PLANTS } from './content';

export type GamePhase = 'prepare' | 'play' | 'won' | 'lost';

export interface GameState {
  phase: GamePhase;
  sun: number;
  elapsed: number;
  waveIndex: number;
  selected: PlantKind | null;
  shovel: boolean;
  kills: number;
  sunCollected: number;
  /** Seconds of recharge remaining per plant kind (seed bank). */
  recharges: Record<PlantKind, number>;
}

export function createState(level: LevelDef): GameState {
  const recharges = {} as Record<PlantKind, number>;
  for (const kind of Object.keys(PLANTS) as PlantKind[]) recharges[kind] = 0;
  return {
    phase: 'prepare',
    sun: level.initialSun,
    elapsed: 0,
    waveIndex: -1,
    selected: null,
    shovel: false,
    kills: 0,
    sunCollected: 0,
    recharges,
  };
}

export interface ScheduledSpawn {
  kind: import('./content').ZombieKind;
  /** Absolute world time of the spawn. */
  at: number;
  wave: number;
}
