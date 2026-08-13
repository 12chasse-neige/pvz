/**
 * Sprite drawing: draws one atlas frame at a world position with the
 * sprite's ground-contact pivot, optional mirroring, scale and alpha.
 * Returns false when the sprite or atlas is missing (callers fall back to
 * procedural painters).
 */
import type { AssetManager } from '../../core/AssetManager';

export interface SpriteDrawOptions {
  flipX?: boolean;
  scale?: number;
  alpha?: number;
}

export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  assets: AssetManager,
  sprite: string,
  frame: number,
  x: number,
  y: number,
  opts: SpriteDrawOptions = {},
): boolean {
  const def = assets.getSprite(sprite);
  if (!def) return false;
  const img = assets.getImage(def.atlas);
  if (!img) return false;
  const rect = def.frames[frame];
  if (!rect) return false;
  const s = opts.scale ?? 1;
  const scaleInv = assets.getManifest()?.scale ?? 2;
  const lw = (rect.w / scaleInv) * s;
  const lh = (rect.h / scaleInv) * s;
  const pivot = def.pivots?.[frame] ?? def.pivot;
  const px = pivot[0] * lw;
  const py = pivot[1] * lh;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.translate(x, y);
  if (opts.flipX) {
    ctx.scale(-1, 1);
    ctx.drawImage(img as unknown as CanvasImageSource, rect.x, rect.y, rect.w, rect.h, px - lw, -py, lw, lh);
  } else {
    ctx.drawImage(img as unknown as CanvasImageSource, rect.x, rect.y, rect.w, rect.h, -px, -py, lw, lh);
  }
  ctx.restore();
  return true;
}
