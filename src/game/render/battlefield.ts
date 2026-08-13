/**
 * Layered battlefield scenery: baked environment textures (or cached
 * procedural fallbacks), drifting parallax clouds, soft cloud shadows,
 * ambient motes, foreground foliage and a lighting pass. All gradients,
 * blobs and frames are pre-rendered once — no per-frame allocations.
 */
import type { AssetManager } from '../../core/AssetManager';
import { Rng } from '../../core/Rng';
import type { RenderProfile } from '../anim/types';
import { drawClouds, drawFoliage, drawHouse, drawLawn, drawSky, LOGICAL_H, LOGICAL_W } from '../../art/environment';

export interface LightingState {
  /** Warm victory/celebration sweep 0..1. */
  warm: number;
  /** Major-wave alert tint 0..1. */
  alert: number;
  /** Explosion white flash 0..1. */
  flash: number;
}

interface Layer {
  img?: CanvasImageSource;
  canvas?: HTMLCanvasElement;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
}

interface Insect {
  y: number;
  speed: number;
  flap: number;
  phase: number;
  hue: number;
  size: number;
}

interface Blade {
  x: number;
  h: number;
  phase: number;
  tilt: number;
}

export class Battlefield {
  private readonly assets: AssetManager;
  private layers = new Map<string, Layer>();
  private shadowBlob: HTMLCanvasElement;
  private cloudBlob: HTMLCanvasElement;
  private vignette: HTMLCanvasElement;
  private alertFrame: HTMLCanvasElement;
  private motes: Mote[] = [];
  private insects: Insect[] = [];
  private blades: Blade[] = [];
  private silhouetteCache = new Map<string, HTMLCanvasElement>();
  constructor(assets: AssetManager) {
    this.assets = assets;
    this.shadowBlob = buildBlob('rgba(30,45,20,1)', 0.5);
    this.cloudBlob = buildBlob('rgba(20,40,25,1)', 0.28);
    this.vignette = buildVignette();
    this.alertFrame = buildAlertFrame();
    const r = new Rng(20240814);
    for (let i = 0; i < 26; i++) {
      this.motes.push({
        x: r.range(0, LOGICAL_W),
        y: r.range(70, LOGICAL_H),
        r: r.range(0.8, 1.9),
        vx: r.range(2, 6),
        vy: r.range(-4, -1.5),
        phase: r.range(0, Math.PI * 2),
      });
    }
    // ambient butterflies drifting over the lawn
    for (let i = 0; i < 3; i++) {
      this.insects.push({
        y: r.range(110, 420),
        speed: r.range(12, 22) * (i % 2 === 0 ? 1 : -1),
        flap: r.range(7, 10),
        phase: r.range(0, Math.PI * 2),
        hue: i % 2 === 0 ? 40 : 330,
        size: r.range(0.8, 1.2),
      });
    }
    // foreground grass blades for the wind sway
    for (let i = 0; i < 16; i++) {
      this.blades.push({
        x: 44 + r.range(0, LOGICAL_W - 88),
        h: r.range(14, 26),
        phase: r.range(0, Math.PI * 2),
        tilt: r.range(-0.2, 0.2),
      });
    }
  }

  /** Swap baked textures in once they are decoded (call after preload). */
  refreshFromAssets(): void {
    for (const name of ['env-sky', 'env-clouds', 'env-house', 'env-lawn', 'env-foliage'] as const) {
      const img = this.assets.getImage(name);
      if (img) this.layers.set(name, { img: img as unknown as CanvasImageSource });
    }
  }

  private fallback(name: string, draw: (ctx: CanvasRenderingContext2D) => void): CanvasImageSource {
    let layer = this.layers.get(name);
    if (layer?.img) return layer.img;
    if (layer?.canvas) return layer.canvas;
    const c = document.createElement('canvas');
    c.width = LOGICAL_W;
    c.height = LOGICAL_H;
    const ctx = c.getContext('2d')!;
    draw(ctx);
    this.layers.set(name, { canvas: c });
    return c;
  }

  /** Sky → drifting clouds → house → lawn → cloud shadows → motes. */
  drawBack(ctx: CanvasRenderingContext2D, t: number, profile: RenderProfile): void {
    const sky = this.assets.getImage('env-sky')
      ? (this.assets.getImage('env-sky') as unknown as CanvasImageSource)
      : this.fallback('env-sky', drawSky);
    const clouds = this.assets.getImage('env-clouds')
      ? (this.assets.getImage('env-clouds') as unknown as CanvasImageSource)
      : this.fallback('env-clouds', (c) => drawClouds(c, 0));
    const house = this.assets.getImage('env-house')
      ? (this.assets.getImage('env-house') as unknown as CanvasImageSource)
      : this.fallback('env-house', drawHouse);
    const lawn = this.assets.getImage('env-lawn')
      ? (this.assets.getImage('env-lawn') as unknown as CanvasImageSource)
      : this.fallback('env-lawn', drawLawn);

    ctx.drawImage(sky, 0, 0, LOGICAL_W, LOGICAL_H);
    // parallax cloud drift (subtle: ≤ 6 px offset)
    const drift = profile.ambient ? (t * 2.2) % LOGICAL_W : 0;
    ctx.drawImage(clouds, -drift, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(clouds, LOGICAL_W - drift, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(house, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.drawImage(lawn, 0, 0, LOGICAL_W, LOGICAL_H);

    if (profile.ambient) {
      // soft drifting cloud shadows over the lawn
      for (let i = 0; i < 2; i++) {
        const speed = 9 + i * 5;
        const w = 260 + i * 90;
        const x = ((t * speed + i * 420) % (LOGICAL_W + w * 2)) - w;
        const y = 150 + i * 170;
        ctx.globalAlpha = 0.10;
        ctx.drawImage(this.cloudBlob, x, y, w, w * 0.26);
        ctx.globalAlpha = 1;
      }
      // ambient motes
      const density = profile.ambientDensity;
      if (density > 0) {
        for (const m of this.motes) {
          const mx = (m.x + t * m.vx) % LOGICAL_W;
          const my = ((m.y + t * m.vy) % (LOGICAL_H - 70)) + 70;
          const tw = 0.45 + 0.25 * Math.sin(t * 1.7 + m.phase);
          ctx.globalAlpha = 0.16 * density * tw;
          ctx.fillStyle = '#f5f0c8';
          ctx.beginPath();
          ctx.arc(mx, my, m.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // ambient butterflies
      if (density > 0) {
        for (let i = 0; i < this.insects.length; i++) {
          const b = this.insects[i]!;
          const cx = LOGICAL_W - 40 + Math.sin(t * 0.5 + b.phase) * 30 - ((t * b.speed + i * 260) % (LOGICAL_W + 160)) + 80;
          const cy = b.y + Math.sin(t * 0.9 + b.phase) * 22;
          const flap = Math.abs(Math.sin(t * b.flap + b.phase));
          ctx.globalAlpha = 0.5 * density;
          ctx.fillStyle = b.hue === 40 ? '#ffd84d' : '#ff8fa0';
          for (const side of [-1, 1] as const) {
            ctx.save();
            ctx.translate(cx + side * 2, cy);
            ctx.rotate(side * (0.5 + flap * 0.7));
            ctx.beginPath();
            ctx.ellipse(side * 2.6, 0, 2.6 * b.size, 2.1 * b.size, side * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = 'rgba(60,40,20,0.8)';
          ctx.beginPath();
          ctx.ellipse(cx, cy, 0.8 * b.size, 2 * b.size, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  drawFront(ctx: CanvasRenderingContext2D, t: number): void {
    const foliage = this.assets.getImage('env-foliage')
      ? (this.assets.getImage('env-foliage') as unknown as CanvasImageSource)
      : this.fallback('env-foliage', drawFoliage);
    ctx.drawImage(foliage, 0, 0, LOGICAL_W, LOGICAL_H);
    // wind-swayed foreground grass blades along the bottom edge
    ctx.strokeStyle = '#5f9e46';
    ctx.lineCap = 'round';
    for (const blade of this.blades) {
      const sway = Math.sin(t * 1.3 + blade.phase) * 3.2;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(blade.x, LOGICAL_H - 6);
      ctx.quadraticCurveTo(blade.x + sway * 0.4 + blade.tilt * blade.h, LOGICAL_H - 6 - blade.h * 0.6, blade.x + sway + blade.tilt * blade.h * 1.4, LOGICAL_H - 6 - blade.h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Cached dark silhouette of a sprite frame (major-wave distant figures).
   * Built once per sprite/frame/scale; bounded cache.
   */
  silhouette(sprite: string, frame: number, scale: number): HTMLCanvasElement | null {
    const key = sprite + ':' + frame + ':' + scale.toFixed(2);
    let c = this.silhouetteCache.get(key);
    if (c) return c;
    const def = this.assets.getSprite(sprite);
    const img = def ? this.assets.getImage(def.atlas) : undefined;
    const rect = def?.frames[frame];
    if (!def || !img || !rect) return null;
    const manifestScale = this.assets.getManifest()?.scale ?? 2;
    const lw = Math.ceil((rect.w / manifestScale) * scale);
    const lh = Math.ceil((rect.h / manifestScale) * scale);
    c = document.createElement('canvas');
    c.width = Math.max(2, lw);
    c.height = Math.max(2, lh);
    const cx = c.getContext('2d')!;
    const pivot = def.pivots?.[frame] ?? def.pivot;
    const dw = (rect.w / manifestScale) * scale;
    const dh = (rect.h / manifestScale) * scale;
    const px = pivot[0] * dw;
    const py = pivot[1] * dh;
    cx.translate(c.width / 2, c.height);
    cx.drawImage(img as unknown as CanvasImageSource, rect.x, rect.y, rect.w, rect.h, -px, -py, dw, dh);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = '#232b1e';
    cx.fillRect(0, 0, c.width, c.height);
    if (this.silhouetteCache.size > 48) this.silhouetteCache.clear();
    this.silhouetteCache.set(key, c);
    return c;
  }

  /** Distant zombie silhouettes marching at the lawn edge (major waves). */
  drawWaveSilhouettes(ctx: CanvasRenderingContext2D, t: number, intensity: number): void {
    if (intensity <= 0.02) return;
    const variants = ['zombie-basic', 'zombie-cone', 'zombie-flag', 'zombie-basic', 'zombie-bucket'] as const;
    for (let i = 0; i < 5; i++) {
      const drift = (t * 13 + i * 43) % 120;
      const x = LOGICAL_W - 18 - drift;
      const y = 130 + i * 100 + 6;
      const frame = (i * 2 + Math.floor(t * 2)) % 8;
      const c = this.silhouette(variants[i]!, frame, 0.4);
      if (!c) continue;
      ctx.globalAlpha = Math.min(0.9, intensity * 0.9) * (0.5 + 0.5 * Math.sin(t * 3 + i));
      ctx.drawImage(c, x - c.width / 2, y - c.height);
      ctx.globalAlpha = 1;
    }
  }

  /** Screen-space lighting pass: vignette, warm sweep, alert, flash. */
  drawLighting(ctx: CanvasRenderingContext2D, l: LightingState): void {
    ctx.drawImage(this.vignette, 0, 0);
    if (l.warm > 0.003) {
      ctx.globalAlpha = Math.min(1, l.warm);
      const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
      g.addColorStop(0, 'rgba(255,214,110,0.22)');
      g.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.globalAlpha = 1;
    }
    if (l.alert > 0.003) {
      ctx.globalAlpha = Math.min(0.85, l.alert * 0.85);
      ctx.drawImage(this.alertFrame, 0, 0);
      ctx.globalAlpha = 1;
    }
    if (l.flash > 0.003) {
      ctx.globalAlpha = Math.min(0.9, l.flash);
      ctx.fillStyle = '#fff8e8';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.globalAlpha = 1;
    }
  }

  /** Pre-rendered soft ellipse shadow, drawn under every character. */
  contactShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, alpha: number): void {
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.shadowBlob, x - w / 2, y - w * 0.09, w, w * 0.34);
    ctx.globalAlpha = 1;
  }
}

function buildBlob(color: string, peak: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(48, 16, 2, 48, 16, 48);
  g.addColorStop(0, color.replace('1)', peak + ')'));
  g.addColorStop(1, color.replace('1)', '0)'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(48, 16, 47, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function buildVignette(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LOGICAL_W;
  c.height = LOGICAL_H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.42, LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.85);
  g.addColorStop(0, 'rgba(25,20,10,0)');
  g.addColorStop(1, 'rgba(25,18,8,0.20)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = 'rgba(255,210,110,0.045)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  return c;
}

function buildAlertFrame(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LOGICAL_W;
  c.height = LOGICAL_H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  g.addColorStop(0, 'rgba(200,58,42,0)');
  g.addColorStop(0.5, 'rgba(200,58,42,0.28)');
  g.addColorStop(1, 'rgba(200,58,42,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  const g2 = ctx.createLinearGradient(0, 0, LOGICAL_W, 0);
  g2.addColorStop(0, 'rgba(200,58,42,0.32)');
  g2.addColorStop(0.12, 'rgba(200,58,42,0)');
  g2.addColorStop(0.88, 'rgba(200,58,42,0)');
  g2.addColorStop(1, 'rgba(200,58,42,0.32)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  return c;
}
