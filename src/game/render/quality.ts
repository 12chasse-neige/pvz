/**
 * Adaptive render quality. The tier starts from device hints (DPR,
 * viewport, memory, touch form-factor, reduced motion) and then follows a
 * rolling frame-time average: demote after sustained misses of the 60 FPS
 * budget, promote only after a longer stable recovery (hysteresis, no
 * oscillation). Quality NEVER affects simulation rate or difficulty.
 */
import type { RenderProfile, RenderTier } from '../anim/types';
import { RENDER_PROFILES } from '../anim/types';

export interface DeviceHints {
  dpr: number;
  viewportW: number;
  viewportH: number;
  deviceMemory?: number; // GB, if exposed
  coarsePointer: boolean;
  reducedMotion: boolean;
}

/** Pure tier decision (unit-testable). */
export function initialTier(hints: DeviceHints): RenderTier {
  if (hints.reducedMotion) return 'medium';
  const tablet = hints.coarsePointer;
  const smallScreen = Math.min(hints.viewportW, hints.viewportH) <= 768;
  const lowMemory = (hints.deviceMemory ?? 8) <= 3;
  const highDpr = hints.dpr >= 2.5;
  if (tablet || smallScreen || lowMemory) {
    return highDpr ? 'low' : 'medium';
  }
  return 'high';
}

/** Frame-time budget for 60 FPS (ms). */
export const FRAME_BUDGET_MS = 1000 / 60;

export const DEMOTE_THRESHOLD_MS = 17.5;
export const DEMOTE_STREAK = 90; // ~1.5 s of sustained misses
export const PROMOTE_THRESHOLD_MS = 13.5;
export const PROMOTE_STREAK = 360; // ~6 s of stable recovery

/** Pure next-tier decision from rolling stats (unit-testable). */
export function nextTier(
  tier: RenderTier,
  avgFrameMs: number,
  demoteStreak: number,
  promoteStreak: number,
): RenderTier {
  if (tier === 'high') return demoteStreak >= DEMOTE_STREAK && avgFrameMs > DEMOTE_THRESHOLD_MS ? 'medium' : 'high';
  if (tier === 'medium') {
    if (promoteStreak >= PROMOTE_STREAK && avgFrameMs < PROMOTE_THRESHOLD_MS) return 'high';
    return demoteStreak >= DEMOTE_STREAK && avgFrameMs > DEMOTE_THRESHOLD_MS ? 'low' : 'medium';
  }
  return promoteStreak >= PROMOTE_STREAK && avgFrameMs < PROMOTE_THRESHOLD_MS ? 'medium' : 'low';
}

const SAMPLE_COUNT = 60;

export class QualityManager {
  readonly profile: RenderProfile;
  private readonly samples: number[] = [];
  private demoteStreak = 0;
  private promoteStreak = 0;
  private lastAvg = 0;
  onChange: ((profile: RenderProfile) => void) | null = null;

  constructor(hints: DeviceHints) {
    this.profile = { ...RENDER_PROFILES[initialTier(hints)] };
  }

  get tier(): RenderTier {
    return this.profile.tier;
  }

  get avgFrameMs(): number {
    return this.lastAvg;
  }

  /** Feed one rendered frame's duration in ms. */
  sampleFrame(frameMs: number): void {
    this.samples.push(frameMs);
    if (this.samples.length > SAMPLE_COUNT) this.samples.shift();
    if (this.samples.length < SAMPLE_COUNT) return;
    let sum = 0;
    for (const s of this.samples) sum += s;
    this.lastAvg = sum / this.samples.length;
    if (this.lastAvg > DEMOTE_THRESHOLD_MS) {
      this.demoteStreak++;
      this.promoteStreak = 0;
    } else if (this.lastAvg < PROMOTE_THRESHOLD_MS) {
      this.promoteStreak++;
      this.demoteStreak = 0;
    } else {
      this.demoteStreak = 0;
      this.promoteStreak = 0;
    }
    const next = nextTier(this.tier, this.lastAvg, this.demoteStreak, this.promoteStreak);
    if (next !== this.tier) {
      const prev = this.tier;
      Object.assign(this.profile, RENDER_PROFILES[next]);
      this.demoteStreak = 0;
      this.promoteStreak = 0;
      this.onChange?.({ ...this.profile });
      void prev;
    }
  }

  /** Cap a cosmetic particle spawn count by the current profile. */
  scaleParticles(count: number): number {
    return Math.max(1, Math.round(count * this.profile.particleScale));
  }
}
