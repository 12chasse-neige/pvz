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
import { drawBasicZombieFrame, ZOMBIE_H, ZOMBIE_W } from '../src/art/zombie';
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
    ],
    draw: (ctx, clip, frame) => drawPeashooterFrame(ctx, { clip: clip as 'idle' | 'fire', frame }),
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
    ],
    draw: (ctx, clip, frame) => drawPeashooterFrame(ctx, { clip: clip as 'idle' | 'fire', frame, frozen: true }),
  },
  {
    key: 'zombie-basic',
    atlas: 'characters',
    anchor: 'bottom',
    w: ZOMBIE_W,
    h: ZOMBIE_H,
    pivot: [0.5, 0.97],
    defaultClip: 'walk',
    clips: [
      walkClip('walk', 8, 8, [1, 5]),
      {
        name: 'eat',
        fps: 6,
        loop: 'loop',
        frames: [
          { frame: 8 },
          { frame: 9, markers: [{ at: 0, event: 'bite' }] },
          { frame: 10 },
          { frame: 11 },
        ],
      },
      {
        name: 'death',
        fps: 9,
        loop: 'hold',
        frames: [{ frame: 12 }, { frame: 13 }, { frame: 14 }, { frame: 15 }],
      },
    ],
    draw: (ctx, clip, frame) => drawBasicZombieFrame(ctx, clip as 'walk' | 'eat' | 'death', frame),
  },
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
      { name: 'run', fps: 12, loop: 'loop', frames: [1, 2, 3, 4].map((frame) => ({ frame })) },
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
    clips: [{ name: 'boom', fps: 20, loop: 'hold', frames: [0, 1, 2, 3].map((frame) => ({ frame })) }],
    draw: (ctx, _clip, frame) => drawBlastFrame(ctx, frame),
  },
];

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
function measure(job: SpriteJob): { minX: number; minY: number; maxX: number; maxY: number } {
  const probe = createCanvas(PROBE, PROBE);
  const pctx = probe.getContext('2d') as unknown as Ctx;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const clip of job.clips) {
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

function layoutOf(job: SpriteJob): Measured {
  const b = measure(job);
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
    const layout = layoutOf(job);
    for (const clip of job.clips) {
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
  writeFileSync(join(OUT_DIR, name + '.png'), atlas.toBuffer('image/png'));
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
    writeFileSync(join(OUT_DIR, layer.name + '.png'), c.toBuffer('image/png'));
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
    manifest.atlases[name] = { url: 'assets/' + name + '.png', w, h };
    for (const job of jobs) {
      const layout = layoutOf(job);
      const jobFrames = frames
        .filter((f) => f.key === job.key)
        .sort((a, b) => a.frame - b.frame)
        .map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
      const clips: Record<string, AnimationClip> = {};
      for (const clip of job.clips) {
        clips[clip.name] = {
          fps: clip.fps,
          loop: clip.loop,
          frames: clip.frames.map((f) => ({ frame: f.frame, dur: f.dur ?? 1, markers: f.markers })),
          ...(clip.next ? { next: clip.next } : {}),
        };
      }
      manifest.sprites[job.key] = {
        atlas: job.atlas,
        pivot: layout.pivot,
        logicalW: Math.ceil(layout.w),
        logicalH: Math.ceil(layout.h),
        frames: jobFrames,
        clips,
        defaultClip: job.defaultClip,
      };
    }
  }

  // Flat environment textures.
  bakeEnvironment();
  for (const name of ['env-sky', 'env-clouds', 'env-house', 'env-lawn', 'env-foliage'] as const) {
    manifest.textures[name] = { url: 'assets/' + name + '.png', w: LOGICAL_W * SCALE, h: LOGICAL_H * SCALE };
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const total = Object.keys(manifest.sprites).length;
  console.log('baked ' + total + ' sprites + ' + Object.keys(manifest.textures).length + ' environment layers -> public/assets/');
}

main();
