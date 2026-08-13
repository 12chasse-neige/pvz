import { Save } from '../core/Save';
import type { AudioSettings } from '../core/Audio';
import { DEFAULT_AUDIO_SETTINGS } from '../core/Audio';

export interface SaveData {
  /** How many of the LEVELS entries are unlocked (1-based count). */
  unlocked: number;
  best: Record<string, { kills: number; time: number }>;
  audio: AudioSettings;
  /** High-contrast accessibility mode. */
  highContrast: boolean;
  /** Reduced motion override (defaults to the OS preference). */
  reducedMotion: boolean;
}

const DEFAULTS: SaveData = {
  unlocked: 1,
  best: {},
  audio: { ...DEFAULT_AUDIO_SETTINGS },
  highContrast: false,
  reducedMotion: false,
};

/** Migrate legacy saves (v1 stored `muted` at the top level). */
function migrate(raw: Partial<SaveData> & { muted?: boolean }): SaveData {
  const { muted: legacyMuted, ...rest } = raw;
  const data: SaveData = {
    ...DEFAULTS,
    ...rest,
    audio: { ...DEFAULTS.audio, ...(raw.audio ?? {}) },
  };
  if (legacyMuted === true) data.audio.muted = true;
  return data;
}

export const save = new Save<SaveData>('pvz-save-v1', DEFAULTS);

// The underlying Save loads with shallow merge; wrap load/write to migrate.
const rawLoad = save.load.bind(save);
save.load = (): SaveData => migrate(rawLoad() as SaveData & { muted?: boolean });

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
