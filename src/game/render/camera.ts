/**
 * Trauma-based camera shake. Explosions and mowers add trauma; the shake
 * offset is smooth seeded noise (deterministic for a given time), decays
 * exponentially, and is disabled entirely under reduced motion.
 */
import { clamp } from '../../core/math';

const MAX_TRAUMA = 1;
const MAX_OFFSET = 7; // logical px
const MAX_ROT = 0.012; // radians

/** Deterministic 1D value noise: smooth between integer hashes. */
export function seededNoise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const h0 = hash(i + seed);
  const h1 = hash(i + 1 + seed);
  return h0 + (h1 - h0) * u;
}

function hash(n: number): number {
  let x = (n | 0) * 374761393 + 668265263;
  x = ((x ^ (x >>> 13)) | 0) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296; // 0..1
}

export interface CameraOffset {
  x: number;
  y: number;
  rot: number;
}

export class CameraState {
  private trauma = 0;
  private time = 0;
  private readonly seed: number;
  /** Under prefers-reduced-motion the camera never shakes. */
  reducedMotion: boolean;

  constructor(seed = 1337, reducedMotion = false) {
    this.seed = seed;
    this.reducedMotion = reducedMotion;
  }

  get currentTrauma(): number {
    return this.trauma;
  }

  addTrauma(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, MAX_TRAUMA);
  }

  /** Exponential decay; amplitude is trauma² for a punchy feel. */
  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  offset(): CameraOffset {
    if (this.reducedMotion || this.trauma <= 0.001) return { x: 0, y: 0, rot: 0 };
    const a = this.trauma * this.trauma;
    const t = this.time;
    return {
      x: (seededNoise(t * 11.3, this.seed) - 0.5) * 2 * MAX_OFFSET * a,
      y: (seededNoise(t * 9.7, this.seed + 61) - 0.5) * 2 * MAX_OFFSET * a,
      rot: (seededNoise(t * 7.1, this.seed + 127) - 0.5) * 2 * MAX_ROT * a,
    };
  }
}
