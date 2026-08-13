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

export class Battlefield {
  private readonly assets: AssetManager;
  private layers = new Map<string, Layer>();
  private shadowBlob: HTMLCanvasElement;
  private cloudBlob: HTMLCanvasElement;
  private vignette: HTMLCanvasElement;
  private alertFrame: HTMLCanvasElement;
  private motes: Mote[] = [];
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
    }
  }

  drawFront(ctx: CanvasRenderingContext2D, _t: number): void {
    const foliage = this.assets.getImage('env-foliage')
      ? (this.assets.getImage('env-foliage') as unknown as CanvasImageSource)
      : this.fallback('env-foliage', drawFoliage);
    ctx.drawImage(foliage, 0, 0, LOGICAL_W, LOGICAL_H);
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
