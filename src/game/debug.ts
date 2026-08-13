/**
 * Deterministic debug bootstrap for screenshot / performance tests.
 * A `?shot=...` URL boots straight into a scene with a fixed seed, fixed
 * simulation time, forced quality tier and optional entity patches —
 * nothing here runs during normal play.
 */
import type { RenderTier } from './anim/types';
import type { ZombieKind } from './content';
import type { LevelStats } from './events';

/** Plant patch: array tuple or object form both accepted. */
export type DebugPlantPatch = [string, number, number] | { kind: string; col: number; row: number };

export interface DebugZombiePatch {
  kind: ZombieKind;
  row: number;
  x: number;
  hpFrac?: number;
  slowed?: boolean;
}

export interface DebugShotConfig {
  scene: 'menu' | 'levelselect' | 'gallery' | 'result-win' | 'result-lose' | 'game';
  level: number;
  seed: number;
  t?: number;
  tier?: RenderTier;
  reducedMotion?: boolean;
  highContrast?: boolean;
  muted?: boolean;
  plants?: DebugPlantPatch[];
  zombies?: DebugZombiePatch[];
  wallnutHpFrac?: number;
  cherryFuse?: number;
  removeMowers?: boolean;
  galleryGroup?: number;
  stats?: LevelStats;
  /** Live (unfrozen) debug boot for performance scenes. */
  live?: boolean;
}

const SCENES = ['menu', 'levelselect', 'gallery', 'result-win', 'result-lose', 'game'] as const;

function asScene(v: string | null): DebugShotConfig['scene'] {
  return (SCENES as readonly string[]).includes(v ?? '') ? (v as DebugShotConfig['scene']) : 'game';
}

export function debugFromUrl(): DebugShotConfig | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  if (!p.has('shot')) return null;
  const num = (key: string, dflt: number): number => {
    const v = Number(p.get(key));
    return Number.isFinite(v) ? v : dflt;
  };
  const parseJson = <T,>(key: string): T | undefined => {
    const raw = p.get(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  };
  const config: DebugShotConfig = {
    scene: asScene(p.get('scene')),
    level: num('level', 0),
    seed: num('seed', 42),
    t: p.has('t') ? num('t', 2) : undefined,
    tier: (p.get('tier') as RenderTier | null) ?? undefined,
    reducedMotion: p.get('motion') === '0' ? true : p.get('motion') === '1' ? false : undefined,
    highContrast: p.get('contrast') === '1',
    muted: p.get('muted') === '1',
    plants: parseJson<DebugPlantPatch[]>('plants'),
    zombies: parseJson<DebugZombiePatch[]>('zombies'),
    wallnutHpFrac: p.has('wallnutHpFrac') ? num('wallnutHpFrac', 1) : undefined,
    cherryFuse: p.has('cherryFuse') ? num('cherryFuse', 0.01) : undefined,
    removeMowers: p.get('mowers') === '0',
    galleryGroup: p.has('galleryGroup') ? num('galleryGroup', 0) : undefined,
    stats: parseJson<LevelStats>('stats'),
    live: p.get('live') === '1',
  };
  return config;
}

/** Returns true when the app runs a deterministic screenshot/perf boot. */
export function isDebugBoot(): boolean {
  return debugFromUrl() !== null;
}
