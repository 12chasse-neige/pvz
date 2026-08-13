/**
 * Clip playback: advances a per-actor playback clock at authored
 * cadences, resolves the current frame, fires frame markers, and handles
 * loop / once→next / hold completion. Keys are entity ids (>= 1) or
 * negative ids for scene-side cosmetic actors.
 */
import type { AnimationClip, SpriteAtlasDef } from './types';

export interface MarkerEvent {
  event: string;
  data?: string;
}

interface Playback {
  clip: string;
  time: number;
  frame: number;
  fired: Set<string>;
}

function clipDuration(clip: AnimationClip): number {
  let total = 0;
  for (const f of clip.frames) total += f.dur;
  return total / clip.fps;
}

function frameAt(clip: AnimationClip, time: number): { frame: number; inFrame: number } {
  let t = time;
  for (let i = 0; i < clip.frames.length; i++) {
    const d = clip.frames[i]!.dur / clip.fps;
    if (t < d) return { frame: i, inFrame: t };
    t -= d;
  }
  return { frame: clip.frames.length - 1, inFrame: clip.frames[clip.frames.length - 1]!.dur / clip.fps };
}

export class Animator {
  private states = new Map<number, Playback>();
  /** Current frame index per key (read by painters). */
  private frames = new Map<number, number>();

  constructor(private readonly spriteOf: (sprite: string) => SpriteAtlasDef | undefined) {}

  has(key: number): boolean {
    return this.frames.has(key);
  }

  frameOf(key: number, fallback = 0): number {
    return this.frames.get(key) ?? fallback;
  }

  /**
   * Advance playback for one key. Returns markers fired this step.
   * When the desired clip differs from the current clip the clock resets;
   * a completed non-looping clip follows its `next` chain.
   */
  advance(key: number, sprite: string, desiredClip: string, dt: number, speed = 1): MarkerEvent[] {
    const def = this.spriteOf(sprite);
    if (!def) {
      this.states.delete(key);
      this.frames.delete(key);
      return [];
    }
    let state = this.states.get(key);
    if (!state || state.clip !== desiredClip) {
      state = { clip: desiredClip, time: 0, frame: 0, fired: new Set() };
      this.states.set(key, state);
    }
    const events: MarkerEvent[] = [];
    const maxHops = 4;
    for (let hop = 0; hop < maxHops; hop++) {
      const clip = def.clips[state.clip] ?? def.clips[def.defaultClip];
      if (!clip) break;
      const prev = state.time;
      const next = prev + dt * speed;
      const dur = clipDuration(clip);
      if (clip.loop === 'loop' && next >= dur) {
        // wrap, firing markers across the boundary (exclusive end avoids
        // double-firing markers that sit exactly on the loop point)
        this.collectMarkers(clip, state, prev, dur, events, false);
        state.time = next % dur;
        state.fired.clear();
        this.collectMarkers(clip, state, 0, state.time, events, true);
      } else if (clip.loop !== 'loop' && next >= dur) {
        this.collectMarkers(clip, state, prev, dur, events, true);
        const follow = clip.next;
        if (follow && def.clips[follow]) {
          state.clip = follow;
          state.time = 0;
          state.frame = 0;
          state.fired = new Set();
          dt = next - dur;
          continue;
        }
        // hold on the last frame
        state.time = dur;
        state.frame = clip.frames.length - 1;
      } else {
        this.collectMarkers(clip, state, prev, next, events, true);
        state.time = next;
      }
      break;
    }
    // resolve final frame
    const clipNow = def.clips[state.clip] ?? def.clips[def.defaultClip];
    if (clipNow) {
      const { frame } = frameAt(clipNow, state.time);
      state.frame = frame;
      this.frames.set(key, clipNow.frames[frame]!.frame);
    }
    return events;
  }

  remove(key: number): void {
    this.states.delete(key);
    this.frames.delete(key);
  }

  clear(): void {
    this.states.clear();
    this.frames.clear();
  }

  private collectMarkers(
    clip: AnimationClip,
    state: Playback,
    from: number,
    to: number,
    out: MarkerEvent[],
    inclusiveEnd: boolean,
  ): void {
    let t = 0;
    for (const f of clip.frames) {
      const d = f.dur / clip.fps;
      if (f.markers) {
        for (const m of f.markers) {
          const at = t + m.at;
          const inside = inclusiveEnd ? at >= from && at <= to : at >= from && at < to;
          if (inside) {
            const id = state.clip + ':' + f.frame + ':' + m.event;
            if (!state.fired.has(id)) {
              state.fired.add(id);
              out.push({ event: m.event, data: m.data });
            }
          }
        }
      }
      t += d;
    }
  }
}
