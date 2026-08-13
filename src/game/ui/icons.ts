/**
 * UI icon painting: prefers baked atlas frames, falls back to the same
 * source art drawn procedurally when an atlas is missing.
 */
import type { AssetManager } from '../../core/AssetManager';
import {
  drawFlagIcon,
  drawLockIcon,
  drawPauseIcon,
  drawShovelIcon,
  drawSoundOffIcon,
  drawSoundOnIcon,
  drawSunIcon,
  drawUnknownIcon,
  drawZombieIcon,
} from '../../art/ui';
import { paintCherry, paintPeashooter, paintSunflower, paintWallnut } from '../render/painters';
import { drawSpriteFrame } from '../render/sprites';

export type ToolIconKind = 'sun' | 'shovel' | 'pause' | 'sound-on' | 'sound-off' | 'flag' | 'lock' | 'zombie' | 'unknown';

export function drawToolIcon(ctx: CanvasRenderingContext2D, assets: AssetManager, kind: ToolIconKind): void {
  if (drawSpriteFrame(ctx, assets, 'ui.' + kind, 0, 0, 0, { scale: 1 })) return;
  switch (kind) {
    case 'sun':
      drawSunIcon(ctx);
      break;
    case 'shovel':
      drawShovelIcon(ctx);
      break;
    case 'pause':
      drawPauseIcon(ctx);
      break;
    case 'sound-on':
      drawSoundOnIcon(ctx);
      break;
    case 'sound-off':
      drawSoundOffIcon(ctx);
      break;
    case 'flag':
      drawFlagIcon(ctx);
      break;
    case 'lock':
      drawLockIcon(ctx);
      break;
    case 'zombie':
      drawZombieIcon(ctx);
      break;
    default:
      drawUnknownIcon(ctx);
      break;
  }
}

/** Seed-card portrait for a plant kind. Caller provides a ≥48×56 canvas. */
export function drawSeedPortrait(ctx: CanvasRenderingContext2D, assets: AssetManager, kind: string): void {
  const spriteKey = kind === 'peashooter' ? 'peashooter' : kind === 'snowpea' ? 'snowpea' : null;
  const def = spriteKey ? assets.getSprite(spriteKey) : undefined;
  const hasSprite = !!def && !!assets.getImage(def.atlas);
  ctx.save();
  if (hasSprite && spriteKey) {
    ctx.translate(24, 50);
    drawSpriteFrame(ctx, assets, spriteKey, 0, 0, 0, { scale: 0.66 });
  } else {
    ctx.translate(24, 30);
    switch (kind) {
      case 'peashooter':
        paintPeashooter(ctx, 0, { frozen: false, recoil: 0 });
        break;
      case 'snowpea':
        paintPeashooter(ctx, 0, { frozen: true, recoil: 0 });
        break;
      case 'sunflower':
        paintSunflower(ctx, 0, { glow: 0 });
        break;
      case 'wallnut':
        paintWallnut(ctx, { hpFrac: 1 });
        break;
      case 'cherrybomb':
        paintCherry(ctx, 0, { frac: 1 });
        break;
      default:
        drawUnknownIcon(ctx);
        break;
    }
  }
  ctx.restore();
}
