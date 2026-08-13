import { Save } from '../core/Save';

export interface SaveData {
  /** How many of the LEVELS entries are unlocked (1-based count). */
  unlocked: number;
  best: Record<string, { kills: number; time: number }>;
  muted: boolean;
}

const DEFAULTS: SaveData = { unlocked: 1, best: {}, muted: false };

export const save = new Save<SaveData>('pvz-save-v1', DEFAULTS);

export function recordResult(levelIndex: number, kills: number, time: number): SaveData {
  const data = save.load();
  data.unlocked = Math.max(data.unlocked, levelIndex + 2); // next level (index + 1) becomes unlocked
  const levelId = 'day-' + (levelIndex + 1);
  const prev = data.best[levelId];
  if (!prev || kills > prev.kills) {
    data.best[levelId] = { kills, time };
  }
  save.write(data);
  return data;
}
