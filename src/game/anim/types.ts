/**
 * Typed visual interfaces for the sprite/animation layer.
 *
 * The runtime consumes a baked `AtlasManifest` (JSON) produced by
 * `scripts/bake-assets.ts` from the editable source art in `src/art/`.
 * Simulation code never imports these types: they are render-only.
 */

/** Animation states a character can be in (render-side interpretation). */
export type AnimationState =
  | 'spawn'
  | 'idle'
  | 'attack'
  | 'anticipate'
  | 'recover'
  | 'produce'
  | 'walk'
  | 'eat'
  | 'hit'
  | 'slowed-walk'
  | 'death'
  | 'run'
  | 'fuse'
  | 'celebrate';

/** How a clip plays. */
export type LoopMode = 'loop' | 'once' | 'hold';

/** A cosmetic event fired when playback crosses a marker. */
export interface FrameMarker {
  /** Seconds from the start of this frame's display. */
  at: number;
  /** Cosmetic event name: 'muzzle', 'footstep', 'bite', 'flash', 'sound', … */
  event: string;
  /** Optional event payload (e.g. a sound variation id). */
  data?: string;
}

/** One frame of an animation clip. */
export interface AnimationFrame {
  /** Frame index in the sprite's frame list (already rect-mapped). */
  frame: number;
  /** Display duration in clip-time units (fractions of 1/fps). */
  dur: number;
  markers?: FrameMarker[];
}

/** A named animation clip. */
export interface AnimationClip {
  /** Authored playback cadence in frames per second. */
  fps: number;
  loop: LoopMode;
  frames: AnimationFrame[];
  /** Clip to fall back to when a non-looping clip finishes ('idle' etc.). */
  next?: string;
}

/** A frame rectangle inside an atlas, in atlas pixels. */
export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One sprite's data in the manifest. */
export interface SpriteAtlasDef {
  /** Which atlas image this sprite lives in. */
  atlas: string;
  /** Normalized pivot (ground contact), e.g. [0.5, 0.92]. */
  pivot: [number, number];
  /** Optional per-frame pivots (frames may be individually measured). */
  pivots?: [number, number][];
  /** Logical (1×) size of the largest frame, for layout/fallback. */
  logicalW: number;
  logicalH: number;
  /** Atlas-pixel rectangles per frame index. */
  frames: AtlasRect[];
  /** Named animation clips. */
  clips: Record<string, AnimationClip>;
  /** Default clip when no resolver applies. */
  defaultClip: string;
}

/** A packed atlas image. */
export interface AtlasDef {
  url: string;
  w: number;
  h: number;
}

/** A full-canvas texture (environment layers are stored flat, not packed). */
export interface TextureDef {
  url: string;
  w: number;
  h: number;
}

/** Top-level manifest file (public/assets/manifest.json). */
export interface AtlasManifest {
  format: 1;
  /** Scale factor used when baking (2 = double logical resolution). */
  scale: number;
  meta: {
    name: string;
    authors: string[];
    license: string;
    artBible: string;
  };
  atlases: Record<string, AtlasDef>;
  textures: Record<string, TextureDef>;
  sprites: Record<string, SpriteAtlasDef>;
}

/**
 * Render quality tiers. Simulation rate, collision, wave timing and
 * difficulty never depend on these.
 */
export type RenderTier = 'high' | 'medium' | 'low';

/** Per-tier settings consumed by painters. */
export interface RenderProfile {
  tier: RenderTier;
  /** 0..1 — particle spawn multiplier. */
  particleScale: number;
  /** Absolute cap of live cosmetic particle entities. */
  particleCap: number;
  /** Contact shadows on/off. */
  shadows: boolean;
  /** Dynamic glow layers (muzzle, sun, cherry pre-flash). */
  glow: boolean;
  /** Cloud shadows + parallax drift. */
  ambient: boolean;
  /** Ambient mote density 0..1. */
  ambientDensity: number;
  /** Motion streaks on projectiles. */
  streaks: boolean;
  /** Cap on device pixel ratio for the backing store. */
  dprCap: number;
  /** Whether atlases render at full 2× (false = logical scale). */
  fullRes: boolean;
}

export const RENDER_PROFILES: Record<RenderTier, RenderProfile> = {
  high: {
    tier: 'high',
    particleScale: 1,
    particleCap: 400,
    shadows: true,
    glow: true,
    ambient: true,
    ambientDensity: 1,
    streaks: true,
    dprCap: 2,
    fullRes: true,
  },
  medium: {
    tier: 'medium',
    particleScale: 0.6,
    particleCap: 220,
    shadows: true,
    glow: false,
    ambient: true,
    ambientDensity: 0.45,
    streaks: true,
    dprCap: 1.75,
    fullRes: true,
  },
  low: {
    tier: 'low',
    particleScale: 0.3,
    particleCap: 90,
    shadows: true,
    glow: false,
    ambient: false,
    ambientDensity: 0,
    streaks: false,
    dprCap: 1.25,
    fullRes: false,
  },
};

/** Result of validating a raw manifest: typed manifest or a list of problems. */
export type ManifestValidation =
  | { ok: true; manifest: AtlasManifest }
  | { ok: false; errors: string[] };
