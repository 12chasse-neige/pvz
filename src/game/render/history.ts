/**
 * Previous-position render history for smooth fixed-timestep
 * interpolation. Positions are snapshotted at the start of every fixed
 * simulation step (see sysSnapshotHistory in systems.ts) and painters
 * render lerp(previous, current, alpha) at the display refresh rate.
 */
import type { Entity, World } from '../../core/ecs/World';
import type { Position } from '../../game/components';

export const PREV_POSITION = 'PrevPosition';

/** Copy every entity's Position into its PrevPosition (first sim system). */
export function snapshotHistory(world: World): void {
  for (const e of world.query(PREV_POSITION, 'Position')) {
    const p = world.get<Position>(e, 'Position')!;
    const prev = world.get<Position>(e, PREV_POSITION)!;
    prev.x = p.x;
    prev.y = p.y;
  }
}

/** Initialize both positions identically (call on spawn). */
export function initHistory(world: World, e: Entity, x: number, y: number): void {
  const prev = world.get<Position>(e, PREV_POSITION);
  if (prev) {
    prev.x = x;
    prev.y = y;
  }
}

/** Reset history after a teleport so no streak is drawn. */
export function resetHistory(world: World, e: Entity): void {
  const p = world.get<Position>(e, 'Position');
  const prev = world.get<Position>(e, PREV_POSITION);
  if (p && prev) {
    prev.x = p.x;
    prev.y = p.y;
  }
}

/** Interpolated render position; falls back to current when absent. */
export function interpPos(
  world: World,
  e: Entity,
  alpha: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const p = world.get<Position>(e, 'Position');
  if (!p) return { x: 0, y: 0 };
  const prev = world.get<Position>(e, PREV_POSITION);
  if (!prev) {
    out.x = p.x;
    out.y = p.y;
    return out;
  }
  out.x = prev.x + (p.x - prev.x) * alpha;
  out.y = prev.y + (p.y - prev.y) * alpha;
  return out;
}
