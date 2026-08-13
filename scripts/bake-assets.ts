/**
 * Asset baker: rasterizes the editable source art (src/art/) at 2× logical
 * resolution, packs frames into sprite atlases, and writes the runtime
 * artifacts to public/assets/:
 *   - characters.png / effects.png / ui.png      (packed, transparent PNG)
 *   - env-*.png                                   (flat environment layers)
 *   - manifest.json                               (typed atlas metadata)
 *
 * Run: pnpm bake   (requires @napi-rs/canvas; outputs are committed)
 */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnimationClip, AtlasManifest, FrameMarker, LoopMode } from '../src/game/anim/types';
import { drawClouds, drawFoliage, drawHouse, drawLawn, drawSky, LOGICAL_H, LOGICAL_W } from '../src/art/environment';
import { drawBlastFrame, drawMowerFrame, drawPeaFrame, drawSunFrame, MOWER_H, MOWER_W, PEA_H, PEA_W, SUN_H, SUN_W, BLAST_H, BLAST_W } from '../src/art/effects';
import { drawPeashooterFrame, PEASHOOTER_H, PEASHOOTER_W } from '../src/art/peashooter';
import { drawSunflowerFrame, SUNFLOWER_H, SUNFLOWER_W } from '../src/art/sunflower';
import { drawWallnutFrame, WALLNUT_H, WALLNUT_W } from '../src/art/wallnut';
import { drawCherryFrame, CHERRY_H, CHERRY_W } from '../src/art/cherry';
import { drawZombieFrame, ZOMBIE_VARIANT_H, ZOMBIE_VARIANT_W } from '../src/art/zombie';
import type { ZombieVariant } from '../src/art/zombie';
import {
  drawFlagIcon,
  drawLockIcon,
  drawPauseIcon,
  drawSeedPacket,
  drawShovelIcon,
  drawSoundOffIcon,
  drawSoundOnIcon,
  drawSunIcon,
  drawUnknownIcon,
  drawZombieIcon,
} from '../src/art/ui';

type Ctx = CanvasRenderingContext2D;

const SCALE = 2;
const PAD = 2;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

interface ClipJob {
  name: string;
  fps: number;
  loop: LoopMode;
  frames: { frame: number; dur?: number; markers?: FrameMarker[] }[];
  next?: string;
}

interface SpriteJob {
  key: string;
  atlas: 'characters' | 'effects' | 'ui';
  w: number;
  h: number;
  /** 'bottom' = pivot at bbox bottom-center (ground contact); 'center' = pivot at art origin. */
  anchor: 'bottom' | 'center';
  pivot: [number, number];
  defaultClip: string;
  clips: ClipJob[];
  draw: (ctx: Ctx, clip: string, frame: number) => void;
}

/** Footstep markers on the walk cycle (cosmetic dust + sound cues). */
function walkClip(name: string, fps: number, count: number, footFrames: number[]): ClipJob {
  return {
    name,
    fps,
    loop: 'loop',
    frames: Array.from({ length: count }, (_, i) => ({
      frame: i,
      markers: footFrames.includes(i) ? [{ at: 0, event: 'footstep' }] : undefined,
    })),
  };
}

const SPRITES: SpriteJob[] = [
  {
    key: 'peashooter',
    atlas: 'characters',
    anchor: 'bottom',
    w: PEASHOOTER_W,
    h: PEASHOOTER_H,
    pivot: [0.5, 0.93],
    defaultClip: 'idle',
    clips: [
      { name: 'idle', fps: 10, loop: 'loop', frames: [0, 1, 2, 3, 4, 5].map((frame) => ({ frame })) },
      {
        name: 'fire',
        fps: 14,
        loop: 'once',
        next: 'idle',
        frames: [
          { frame: 6, markers: [{ at: 0, event: 'aim' }] },
          { frame: 7, markers: [{ at: 0, event: 'muzzle' }, { at: 0, event: 'shoot' }] },
          { frame: 8 },
        ],
      },
      { name: 'hit', fps: 10, loop: 'once', next: 'idle', frames: [{ frame: 9 }, { frame: 10 }] },
    ],
    draw: (ctx, clip, frame) => drawPeashooterFrame(ctx, { clip: clip as 'idle' | 'fire' | 'hit', frame }),
  },
  {
    key: 'snowpea',
    atlas: 'characters',
    anchor: 'bottom',
    w: PEASHOOTER_W,
    h: PEASHOOTER_H,
    pivot: [0.5, 0.93],
    defaultClip: 'idle',
    clips: [
      { name: 'idle', fps: 10, loop: 'loop', frames: [0, 1, 2, 3, 4, 5].map((frame) => ({ frame })) },
      {
        name: 'fire',
        fps: 14,
        loop: 'once',
        next: 'idle',
        frames: [
          { frame: 6 },
          { frame: 7, markers: [{ at: 0, event: 'muzzle' }, { at: 0, event: 'shoot' }] },
          { frame: 8 },
        ],
      },
      { name: 'hit', fps: 10, loop: 'once', next: 'idle', frames: [{ frame: 9 }, { frame: 10 }] },
    ],
    draw: (ctx, clip, frame) =>
      drawPeashooterFrame(ctx, { clip: clip as 'idle' | 'fire' | 'hit', frame, frozen: true }),
  },
  {
    key: 'sunflower',
    atlas: 'characters',
    anchor: 'bottom',
    w: SUNFLOWER_W,
    h: SUNFLOWER_H,
    pivot: [0.5, 0.94],
    defaultClip: 'idle',
    clips: [
      { name: 'idle', fps: 10, loop: 'loop', frames: [0, 1, 2, 3, 4, 5, 6, 7].map((frame) => ({ frame })) },
      {
        name: 'produce',
        fps: 12,
        loop: 'once',
        next: 'idle',
        frames: [
          { frame: 8 },
          { frame: 9 },
          { frame: 10 },
          { frame: 11, markers: [{ at: 0, event: 'sunburst' }] },
        ],
      },
    ],
    draw: (ctx, clip, frame) => drawSunflowerFrame(ctx, clip as 'idle' | 'produce', frame),
  },
  {
    key: 'wallnut',
    atlas: 'characters',
    anchor: 'bottom',
    w: WALLNUT_W,
    h: WALLNUT_H,
    pivot: [0.5, 0.94],
    defaultClip: 'full',
    clips: [
      { name: 'full', fps: 6, loop: 'loop', frames: [0, 1, 2, 3, 4, 5].map((frame) => ({ frame })) },
      { name: 'cracked', fps: 6, loop: 'loop', frames: [6, 7, 8, 9, 10, 11].map((frame) => ({ frame })) },
      { name: 'broken', fps: 6, loop: 'loop', frames: [12, 13, 14, 15, 16, 17].map((frame) => ({ frame })) },
      { name: 'squash', fps: 10, loop: 'once', next: 'full', frames: [{ frame: 18 }, { frame: 19 }, { frame: 20 }] },
    ],
    draw: (ctx, clip, frame) => drawWallnutFrame(ctx, clip, frame),
  },
  {
    key: 'cherry',
    atlas: 'characters',
    anchor: 'bottom',
    w: CHERRY_W,
    h: CHERRY_H,
    pivot: [0.5, 0.94],
    defaultClip: 'idle',
    clips: [
      { name: 'idle', fps: 8, loop: 'loop', frames: [0, 1, 2, 3, 4, 5].map((frame) => ({ frame })) },
      { name: 'urgent', fps: 10, loop: 'loop', frames: [6, 7, 8].map((frame) => ({ frame })) },
      { name: 'preflash', fps: 8, loop: 'loop', frames: [9, 10].map((frame) => ({ frame })) },
    ],
    draw: (ctx, clip, frame) => drawCherryFrame(ctx, clip as 'idle' | 'urgent' | 'preflash', frame),
  },
  ...zombieJobs(),
  {
    key: 'pea',
    atlas: 'effects',
    anchor: 'center',
    w: PEA_W,
    h: PEA_H,
    pivot: [0.5, 0.5],
    defaultClip: 'spin',
    clips: [{ name: 'spin', fps: 12, loop: 'loop', frames: [0, 1, 2].map((frame) => ({ frame })) }],
    draw: (ctx, _clip, frame) => drawPeaFrame(ctx, frame, false),
  },
  {
    key: 'pea-frozen',
    atlas: 'effects',
    anchor: 'center',
    w: PEA_W,
    h: PEA_H,
    pivot: [0.5, 0.5],
    defaultClip: 'spin',
    clips: [{ name: 'spin', fps: 12, loop: 'loop', frames: [0, 1, 2].map((frame) => ({ frame })) }],
    draw: (ctx, _clip, frame) => drawPeaFrame(ctx, frame, true),
  },
  {
    key: 'sun',
    atlas: 'effects',
    anchor: 'center',
    w: SUN_W,
    h: SUN_H,
    pivot: [0.5, 0.5],
    defaultClip: 'pulse',
    clips: [{ name: 'pulse', fps: 6, loop: 'loop', frames: [0, 1, 2].map((frame) => ({ frame })) }],
    draw: (ctx, _clip, frame) => drawSunFrame(ctx, frame),
  },
  {
    key: 'mower',
    atlas: 'effects',
    anchor: 'bottom',
    w: MOWER_W,
    h: MOWER_H,
    pivot: [0.5, 0.49],
    defaultClip: 'idle',
    clips: [
      { name: 'idle', fps: 8, loop: 'loop', frames: [{ frame: 0 }] },
      {
        name: 'run',
        fps: 12,
        loop: 'loop',
        frames: [
          { frame: 1, markers: [{ at: 0, event: 'clip' }] },
          { frame: 2, markers: [{ at: 0, event: 'exhaust' }] },
          { frame: 3, markers: [{ at: 0, event: 'clip' }] },
          { frame: 4 },
        ],
      },
    ],
    draw: (ctx, _clip, frame) => drawMowerFrame(ctx, frame),
  },
  {
    key: 'blast',
    atlas: 'effects',
    anchor: 'center',
    w: BLAST_W,
    h: BLAST_H,
    pivot: [0.5, 0.5],
    defaultClip: 'boom',
    clips: [{ name: 'boom', fps:20, loop: 'hold', frames: [0, 1, 2, 3].map((frame) => ({ frame })) }],
    draw: (ctx, _clip, frame) => drawBlastFrame(ctx, frame),
  },
];

/** All five zombie variants share one clip layout (walk/eat/death). */
function zombieJobs(): SpriteJob[] {
  const variants: { kind: ZombieVariant; key: string; walkFps: number; tiers: boolean }[] = [
    { kind: 'basic', key: 'zombie-basic', walkFps: 8, tiers: false },
    { kind: 'cone', key: 'zombie-cone', walkFps: 8, tiers: true },
    { kind: 'bucket', key: 'zombie-bucket', walkFps: 7, tiers: true },
    { kind: 'runner', key: 'zombie-runner', walkFps: 12, tiers: false },
    { kind: 'flag', key: 'zombie-flag', walkFps: 10, tiers: false },
  ];
  return variants.map((v) => {
    const clips: ClipJob[] = [];
    const tierOf = (clip: string): 0 | 1 | 2 =>
      clip === 'walk-dmg1' || clip === 'eat-dmg1' ? 1 : clip === 'walk-dmg2' || clip === 'eat-dmg2' ? 2 : 0;
    if (v.tiers) {
      for (const name of ['walk', 'walk-dmg1', 'walk-dmg2'] as const) {
        const base = name === 'walk' ? 0 : name === 'walk-dmg1' ? 8 : 16;
        clips.push({
          name,
          fps: v.walkFps,
          loop: 'loop',
          frames: Array.from({ length: 8 }, (_, i) => ({
            frame: base + i,
            markers: i === 1 || i === 5 ? [{ at: 0, event: 'footstep' }] : undefined,
          })),
        });
      }
      for (const name of ['eat', 'eat-dmg1', 'eat-dmg2'] as const) {
        const base = name === 'eat' ? 24 : name === 'eat-dmg1' ? 28 : 32;
        clips.push({
          name,
          fps: 6,
          loop: 'loop',
          frames: [
            { frame: base },
            { frame: base + 1, markers: [{ at: 0, event: 'bite' }] },
            { frame: base + 2 },
            { frame: base + 3 },
          ],
        });
      }
      clips.push({ name: 'death', fps: 9, loop: 'hold', frames: [36, 37, 38, 39].map((frame) => ({ frame })) });
    } else {
      clips.push({
        name: 'walk',
        fps: v.walkFps,
        loop: 'loop',
        frames: Array.from({ length: 8 }, (_, i) => ({
          frame: i,
          markers: i === 1 || i === 5 ? [{ at: 0, event: 'footstep' }] : undefined,
        })),
      });
      clips.push({
        name: 'eat',
        fps: 6,
        loop: 'loop',
        frames: [
          { frame: 8 },
          { frame: 9, markers: [{ at: 0, event: 'bite' }] },
          { frame: 10 },
          { frame: 11 },
        ],
      });
      clips.push({ name: 'death', fps: 9, loop: 'hold', frames: [12, 13, 14, 15].map((frame) => ({ frame })) });
    }
    return {
      key: v.key,
      atlas: 'characters' as const,
      anchor: 'bottom' as const,
      w: ZOMBIE_VARIANT_W,
      h: ZOMBIE_VARIANT_H,
      pivot: [0.5, 0.95] as [number, number],
      defaultClip: 'walk',
      clips,
      draw: (ctx: Ctx, clip: string, frame: number) =>
        drawZombieFrame(ctx, { clip: (clip.startsWith('eat') ? 'eat' : clip) as 'walk' | 'eat' | 'death', frame, kind: v.kind, tier: tierOf(clip) }),
    };
  });
}



const UI_ICONS: { key: string; w: number; h: number; pivot: [number, number]; draw: (ctx: Ctx) => void }[] = [
  { key: 'ui.sun', w: 40, h: 40, pivot: [0.5, 0.5], draw: drawSunIcon },
  { key: 'ui.shovel', w: 40, h: 48, pivot: [0.5, 0.62], draw: drawShovelIcon },
  { key: 'ui.pause', w: 40, h: 40, pivot: [0.5, 0.5], draw: drawPauseIcon },
  { key: 'ui.sound-on', w: 40, h: 40, pivot: [0.5, 0.5], draw: drawSoundOnIcon },
  { key: 'ui.sound-off', w: 40, h: 40, pivot: [0.5, 0.5], draw: drawSoundOffIcon },
  { key: 'ui.flag', w: 32, h: 48, pivot: [0.5, 0.92], draw: drawFlagIcon },
  { key: 'ui.lock', w: 40, h: 40, pivot: [0.5, 0.5], draw: drawLockIcon },
  { key: 'ui.unknown', w: 40, h: 40, pivot: [0.5, 0.5], draw: drawUnknownIcon },
  { key: 'ui.zombie', w: 40, h: 40, pivot: [0.5, 0.5], draw: drawZombieIcon },
  {
    key: 'ui.packet',
    w: 64,
    h: 78,
    pivot: [0.5, 0.5],
    draw: (ctx) => drawSeedPacket(ctx, (c) => c, 0, '', false),
  },
];

interface PackedFrame {
  key: string;
  frame: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const PROBE = 512;
const PROBE_OFF = 256;
const MARGIN = 2; // logical px of padding around measured art bounds

/**
 * Measure the union alpha bounding box of every frame of a sprite in ART
 * coordinates (the drawing space whose origin is the ground-contact
 * pivot). This guarantees frames never clip and pivots sit exactly at the
 * character's ground contact.
 */
function measure(job: SpriteJob, clipName: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const probe = createCanvas(PROBE, PROBE);
  const pctx = probe.getContext('2d') as unknown as Ctx;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const clip = job.clips.find((c) => c.name === clipName);
  if (!clip) return { minX: 0, minY: 0, maxX: 4, maxY: 4 };
  {
    for (const f of clip.frames) {
      pctx.clearRect(0, 0, PROBE, PROBE);
      pctx.save();
      pctx.translate(PROBE_OFF, PROBE_OFF);
      job.draw(pctx, clip.name, f.frame);
      pctx.restore();
      const data = pctx.getImageData(0, 0, PROBE, PROBE).data;
      for (let y = 0; y < PROBE; y++) {
        for (let x = 0; x < PROBE; x++) {
          if (data[(y * PROBE + x) * 4 + 3]! > 8) {
            const ax = x - PROBE_OFF;
            const ay = y - PROBE_OFF;
            if (ax < minX) minX = ax;
            if (ax > maxX) maxX = ax;
            if (ay < minY) minY = ay;
            if (ay > maxY) maxY = ay;
          }
        }
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

interface Measured {
  w: number; // logical frame width
  h: number; // logical frame height
  pivot: [number, number];
}

function layoutOf(job: SpriteJob, clipName: string): Measured {
  const b = measure(job, clipName);
  const w = Math.max(4, b.maxX - b.minX + MARGIN * 2);
  const h = Math.max(4, b.maxY - b.minY + MARGIN * 2);
  if (job.anchor === 'bottom') {
    // Ground contact: bottom-center of the measured art.
    const centerX = (b.minX + b.maxX) / 2;
    return {
      w,
      h,
      pivot: [(MARGIN + centerX - b.minX) / w, (MARGIN + b.maxY - b.minY) / h],
    };
  }
  // Center anchor: the art origin (0,0) is the desired center.
  return {
    w,
    h,
    pivot: [(MARGIN - b.minX) / w, (MARGIN - b.minY) / h],
  };
}

function renderFrame(
  job: SpriteJob,
  layout: Measured,
  clipName: string,
  frame: number,
): ReturnType<typeof createCanvas> {
  const c = createCanvas(Math.ceil(layout.w * SCALE), Math.ceil(layout.h * SCALE));
  const ctx = c.getContext('2d') as unknown as Ctx;
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.translate(layout.w * layout.pivot[0], layout.h * layout.pivot[1]);
  job.draw(ctx, clipName, frame);
  ctx.restore();
  return c;
}

function packAtlas(
  frames: { canvas: ReturnType<typeof createCanvas>; key: string; frame: number; w: number; h: number }[],
): { atlasW: number; atlasH: number; out: PackedFrame[] } {
  const sorted = [...frames].sort((a, b) => b.h - a.h);
  const MAX_W = 1024;
  let x = 0;
  let y = 0;
  let rowH = 0;
  let atlasH = 0;
  const out: PackedFrame[] = [];
  for (const f of sorted) {
    if (x + f.w + PAD > MAX_W) {
      x = 0;
      y += rowH + PAD;
      rowH = 0;
    }
    out.push({ key: f.key, frame: f.frame, x, y, w: f.w, h: f.h });
    x += f.w + PAD;
    rowH = Math.max(rowH, f.h);
    atlasH = Math.max(atlasH, y + rowH);
  }
  return { atlasW: MAX_W, atlasH: Math.max(1, atlasH + PAD), out };
}

function buildAtlas(jobs: SpriteJob[], name: 'characters' | 'effects' | 'ui'): { w: number; h: number; frames: PackedFrame[] } {
  const list: { canvas: ReturnType<typeof createCanvas>; key: string; frame: number; w: number; h: number }[] = [];
  for (const job of jobs) {
    for (const clip of job.clips) {
      const layout = layoutOf(job, clip.name);
      for (const f of clip.frames) {
        const canvas = renderFrame(job, layout, clip.name, f.frame);
        list.push({ canvas, key: job.key, frame: f.frame, w: canvas.width, h: canvas.height });
      }
    }
  }
  const { atlasW, atlasH, out } = packAtlas(list);
  const atlas = createCanvas(atlasW, atlasH);
  const actx = atlas.getContext('2d') as unknown as Ctx;
  for (const f of list) {
    const placed = out.find((p) => p.key === f.key && p.frame === f.frame)!;
    actx.drawImage(f.canvas as unknown as Parameters<Ctx['drawImage']>[0], placed.x, placed.y);
  }
  writeFileSync(join(OUT_DIR, name + '.webp'), atlas.toBuffer('image/webp'));
  return { w: atlasW, h: atlasH, frames: out };
}

function bakeEnvironment(): void {
  const layers: { name: string; draw: (ctx: Ctx) => void }[] = [
    { name: 'env-sky', draw: drawSky },
    { name: 'env-clouds', draw: (ctx) => drawClouds(ctx, 0) },
    { name: 'env-house', draw: drawHouse },
    { name: 'env-lawn', draw: drawLawn },
    { name: 'env-foliage', draw: drawFoliage },
  ];
  for (const layer of layers) {
    const c = createCanvas(LOGICAL_W * SCALE, LOGICAL_H * SCALE);
    const ctx = c.getContext('2d') as unknown as Ctx;
    ctx.save();
    ctx.scale(SCALE, SCALE);
    layer.draw(ctx);
    ctx.restore();
    writeFileSync(join(OUT_DIR, layer.name + '.webp'), c.toBuffer('image/webp'));
  }
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const manifest: AtlasManifest = {
    format: 1,
    scale: SCALE,
    meta: {
      name: 'storybook-suburban-garden',
      authors: ['the pvz project (generative art pipeline)'],
      license: 'CC0 1.0 (public domain dedication, original work)',
      artBible: 'docs/ART_BIBLE.md',
    },
    atlases: {},
    textures: {},
    sprites: {},
  };

  // Packed character / effect / UI atlases.
  for (const name of ['characters', 'effects', 'ui'] as const) {
    const jobs = name === 'ui'
      ? UI_ICONS.map((ic): SpriteJob => ({
          key: ic.key,
          atlas: 'ui',
          w: ic.w,
          h: ic.h,
          pivot: ic.pivot,
          defaultClip: 'static',
          clips: [{ name: 'static', fps: 4, loop: 'loop', frames: [{ frame: 0 }] }],
          draw: (ctx) => ic.draw(ctx),
        }))
      : SPRITES.filter((s) => s.atlas === name);
    const { w, h, frames } = buildAtlas(jobs, name);
    manifest.atlases[name] = { url: 'assets/' + name + '.webp', w, h };
    for (const job of jobs) {
      const jobFrames = frames
        .filter((f) => f.key === job.key)
        .sort((a, b) => a.frame - b.frame)
        .map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
      const clips: Record<string, AnimationClip> = {};
      const maxFrame = Math.max(...jobFrames.map((f) => f.frame), 0);
      const pivots: [number, number][] = Array.from({ length: maxFrame + 1 }, () => [0.5, 0.5]);
      let maxW = 4;
      let maxH = 4;
      let defaultPivot: [number, number] = [0.5, 0.5];
      for (const clip of job.clips) {
        const layout = layoutOf(job, clip.name);
        maxW = Math.max(maxW, layout.w);
        maxH = Math.max(maxH, layout.h);
        if (clip.name === job.defaultClip) defaultPivot = layout.pivot;
        for (const f of clip.frames) pivots[f.frame] = layout.pivot;
        clips[clip.name] = {
          fps: clip.fps,
          loop: clip.loop,
          frames: clip.frames.map((f) => ({ frame: f.frame, dur: f.dur ?? 1, markers: f.markers })),
          ...(clip.next ? { next: clip.next } : {}),
        };
      }
      manifest.sprites[job.key] = {
        atlas: job.atlas,
        pivot: defaultPivot,
        pivots,
        logicalW: Math.ceil(maxW),
        logicalH: Math.ceil(maxH),
        frames: jobFrames,
        clips,
        defaultClip: job.defaultClip,
      };
    }
  }

  // Flat environment textures.
  bakeEnvironment();
  for (const name of ['env-sky', 'env-clouds', 'env-house', 'env-lawn', 'env-foliage'] as const) {
    manifest.textures[name] = { url: 'assets/' + name + '.webp', w: LOGICAL_W * SCALE, h: LOGICAL_H * SCALE };
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const total = Object.keys(manifest.sprites).length;
  console.log('baked ' + total + ' sprites + ' + Object.keys(manifest.textures).length + ' environment layers -> public/assets/');
}

main();
