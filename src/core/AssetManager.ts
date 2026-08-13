import type { AtlasManifest, ManifestValidation, SpriteAtlasDef } from '../game/anim/types';

export interface LoadProgress {
  /** Items completed so far. */
  loaded: number;
  /** Total items (manifest = 1 + each atlas/texture). */
  total: number;
  stage: 'manifest' | 'images' | 'done';
  /** Atlases/textures that could not be decoded after retries. */
  failed: string[];
}

type FetchLike = (url: string) => Promise<Response>;

interface ImageLike {
  src: string;
  decode(): Promise<void>;
  width: number;
  height: number;
}

export interface AssetManagerOptions {
  /** Injectable for tests (Node has no fetch/Image). */
  fetchFn?: FetchLike;
  imageFactory?: () => ImageLike;
  maxRetries?: number;
}

/** Pure, standalone structural validation of a raw manifest payload. */
export function validateManifest(raw: unknown): ManifestValidation {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['manifest is not an object'] };
  const m = raw as Record<string, unknown>;
  if (m.format !== 1) errors.push('manifest.format must be 1');
  if (typeof m.scale !== 'number' || m.scale <= 0) errors.push('manifest.scale must be a positive number');
  const atlases = (m.atlases ?? {}) as Record<string, { url?: unknown; w?: unknown; h?: unknown }>;
  const sprites = (m.sprites ?? {}) as Record<
    string,
    {
      atlas?: unknown;
      pivot?: unknown;
      frames?: unknown;
      clips?: unknown;
      defaultClip?: unknown;
      logicalW?: unknown;
      logicalH?: unknown;
    }
  >;
  for (const [name, atlas] of Object.entries(atlases)) {
    if (typeof atlas?.url !== 'string') errors.push('atlas ' + name + ': missing url');
    if (typeof atlas?.w !== 'number' || typeof atlas?.h !== 'number') {
      errors.push('atlas ' + name + ': missing dimensions');
    }
  }
  for (const [key, sprite] of Object.entries(sprites)) {
    if (!sprite || typeof sprite.atlas !== 'string') {
      errors.push('sprite ' + key + ': missing atlas');
      continue;
    }
    if (!atlases[sprite.atlas]) errors.push('sprite ' + key + ': unknown atlas "' + sprite.atlas + '"');
    if (!Array.isArray(sprite.pivot) || sprite.pivot.length !== 2) {
      errors.push('sprite ' + key + ': pivot must be [x, y]');
    }
    if (!Array.isArray(sprite.frames) || sprite.frames.length === 0) {
      errors.push('sprite ' + key + ': no frames');
    }
    if (typeof sprite.defaultClip !== 'string') {
      errors.push('sprite ' + key + ': missing defaultClip');
      continue;
    }
    if (typeof sprite.clips !== 'object' || sprite.clips === null) {
      errors.push('sprite ' + key + ': missing clips');
      continue;
    }
    const clips = sprite.clips as Record<string, { frames?: unknown }>;
    if (!clips[sprite.defaultClip]) errors.push('sprite ' + key + ': defaultClip "' + sprite.defaultClip + '" not found');
    for (const [clipName, clip] of Object.entries(clips)) {
      if (!Array.isArray(clip?.frames) || clip.frames.length === 0) {
        errors.push('sprite ' + key + ' clip ' + clipName + ': no frames');
        continue;
      }
      for (const f of clip.frames as { frame?: unknown; dur?: unknown }[]) {
        if (typeof f?.frame !== 'number' || f.frame < 0 || f.frame >= (sprite.frames as unknown[]).length) {
          errors.push('sprite ' + key + ' clip ' + clipName + ': frame index out of range');
        }
        if (f.dur !== undefined && (typeof f.dur !== 'number' || f.dur <= 0)) {
          errors.push('sprite ' + key + ' clip ' + clipName + ': bad duration');
        }
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: raw as unknown as AtlasManifest };
}

/**
 * Preload pipeline: manifest first (validated), then atlases and textures
 * with per-item retry. Failures are recorded, never fatal: painters fall
 * back to procedural art for anything missing.
 */
export class AssetManager {
  private images = new Map<string, ImageLike>();
  private manifest: AtlasManifest | null = null;
  private failedNames = new Set<string>();
  private readonly fetchFn: FetchLike;
  private readonly imageFactory: () => ImageLike;
  private readonly maxRetries: number;

  constructor(opts: AssetManagerOptions = {}) {
    this.fetchFn = opts.fetchFn ?? ((url) => fetch(url));
    this.imageFactory = opts.imageFactory ?? (() => new Image() as unknown as ImageLike);
    this.maxRetries = opts.maxRetries ?? 2;
  }

  getManifest(): AtlasManifest | null {
    return this.manifest;
  }

  getSprite(key: string): SpriteAtlasDef | undefined {
    return this.manifest?.sprites[key];
  }

  hasImage(name: string): boolean {
    return this.images.has(name);
  }

  getImage(name: string): ImageLike | undefined {
    return this.images.get(name);
  }

  isFailed(name: string): boolean {
    return this.failedNames.has(name);
  }

  /**
   * Load everything: manifest + all atlases + all textures. Reports
   * progress and completes even when some items fail.
   */
  async preload(manifestUrl: string, onProgress?: (p: LoadProgress) => void): Promise<LoadProgress> {
    const report = (stage: LoadProgress['stage'], loaded: number, total: number): void => {
      onProgress?.({ loaded, total, stage, failed: [...this.failedNames] });
    };

    report('manifest', 0, 1);
    let raw: unknown;
    try {
      const res = await this.fetchFn(manifestUrl);
      raw = await res.json();
    } catch (err) {
      this.failedNames.add('manifest');
      report('done', 0, 1);
      return { loaded: 0, total: 1, stage: 'done', failed: ['manifest'] };
    }
    const validation = validateManifest(raw);
    if (!validation.ok) {
      this.failedNames.add('manifest');
      report('done', 0, 1);
      return { loaded: 0, total: 1, stage: 'done', failed: ['manifest'] };
    }
    this.manifest = validation.manifest;
    this.failedNames.delete('manifest');

    const targets: { name: string; url: string }[] = [];
    for (const [name, atlas] of Object.entries(this.manifest.atlases)) {
      targets.push({ name, url: atlas.url });
    }
    for (const [name, tex] of Object.entries(this.manifest.textures)) {
      targets.push({ name, url: tex.url });
    }
    const total = targets.length + 1;
    let loaded = 1;
    report('images', loaded, total);
    await Promise.all(targets.map(async (t) => this.loadImageItem(t.name, t.url)));
    loaded = total - this.failedNames.size;
    report('done', loaded, total);
    return { loaded, total, stage: 'done', failed: [...this.failedNames] };
  }

  /** Retry previously failed items (returns the new progress). */
  async retryFailed(onProgress?: (p: LoadProgress) => void): Promise<LoadProgress> {
    const manifest = this.manifest;
    if (!manifest) return this.preload('assets/manifest.json', onProgress);
    const targets: { name: string; url: string }[] = [];
    for (const name of this.failedNames) {
      const atlas = manifest.atlases[name];
      const tex = manifest.textures[name];
      if (atlas) targets.push({ name, url: atlas.url });
      if (tex) targets.push({ name, url: tex.url });
    }
    for (const t of targets) await this.loadImageItem(t.name, t.url);
    return {
      loaded: targets.length - this.failedNames.size,
      total: targets.length,
      stage: 'done',
      failed: [...this.failedNames],
    };
  }

  private async loadImageItem(name: string, url: string): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const img = this.imageFactory();
        img.src = url;
        await img.decode();
        this.images.set(name, img);
        this.failedNames.delete(name);
        return;
      } catch {
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
        }
      }
    }
    this.failedNames.add(name);
  }
}
