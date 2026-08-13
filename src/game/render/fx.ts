/**
 * Cosmetic FX layer (scene-side, NOT simulation entities): pooled
 * particles with priority caps, cosmetic death actors, and fading ground
 * decals. Purely visual — the deterministic headless simulation never
 * sees any of this.
 */
import type { Animator } from '../anim/playback';
import type { AssetManager } from '../../core/AssetManager';
import { drawSpriteFrame } from './sprites';

export type FxParticleKind = 'dot' | 'spark' | 'smoke' | 'shard';

export interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  maxTtl: number;
  size: number;
  color: string;
  gravity: number;
  kind: FxParticleKind;
  /** 0 = ambient cosmetics, 1 = important attack/status feedback. */
  priority: number;
}

export interface FxActor {
  id: number;
  sprite: string;
  clip: string;
  x: number;
  y: number;
  ttl: number;
  maxTtl: number;
  scale: number;
  flipX: boolean;
}

interface Decal {
  x: number;
  y: number;
  rx: number;
  ttl: number;
  maxTtl: number;
}

interface Flyer {
  sprite: string;
  clip: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  dur: number;
  id: number;
  scale: number;
  onArrive?: () => void;
}

export class CosmeticFx {
  private particles: FxParticle[] = [];
  private actors: FxActor[] = [];
  private decals: Decal[] = [];
  private flyers: Flyer[] = [];
  private nextActorId = -1;
  private cap: number;

  constructor(cap = 200) {
    this.cap = cap;
  }

  setCap(cap: number): void {
    this.cap = Math.max(8, cap);
  }

  get particleCount(): number {
    return this.particles.length;
  }

  get actorCount(): number {
    return this.actors.length;
  }

  spawn(p: FxParticle): void {
    if (this.particles.length < this.cap) {
      this.particles.push(p);
      return;
    }
    // At the cap, replace a lower-priority particle if possible.
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i]!.priority < p.priority) {
        this.particles[i] = p;
        return;
      }
    }
    // Otherwise drop the new ambient particle.
  }

  burst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    kind: FxParticleKind = 'dot',
    priority = 1,
    gravity = 160,
  ): void {
    for (let i = 0; i < count; i++) {
      const ttl = 0.35 + Math.random() * 0.3;
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random() * 0.6) * speed;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.25,
        ttl,
        maxTtl: ttl,
        size: kind === 'smoke' ? 5 + Math.random() * 5 : 2.5 + Math.random() * 2.5,
        color,
        gravity,
        kind,
        priority,
      });
    }
  }

  /** Cosmetic death actor (plays a death clip, then fades out). */
  spawnActor(sprite: string, clip: string, x: number, y: number, ttl = 1.4, scale = 1, flipX = false): number {
    const id = this.nextActorId--;
    this.actors.push({ id, sprite, clip, x, y, ttl, maxTtl: ttl, scale, flipX });
    return id;
  }

  /** Fading scorch decal on the ground (cherry explosions). */
  addScorch(x: number, y: number, rx: number, ttl = 6): void {
    this.decals.push({ x, y, rx, ttl, maxTtl: ttl });
  }

  /** Fly a sprite along a bezier arc to a target (e.g. sun → counter). */
  spawnFlyer(
    sprite: string,
    clip: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    dur: number,
    scale = 1,
    onArrive?: () => void,
  ): void {
    const id = this.nextActorId--;
    this.flyers.push({ sprite, clip, fromX, fromY, toX, toY, t: 0, dur, id, scale, onArrive });
  }

  update(dt: number, animator: Animator, assets: AssetManager): void {
    for (const p of this.particles) {
      p.ttl -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.ttl > 0);
    for (const a of this.actors) {
      a.ttl -= dt;
      animator.advance(a.id, a.sprite, a.clip, dt, 1);
    }
    for (const a of [...this.actors]) {
      if (a.ttl <= 0) {
        animator.remove(a.id);
        this.actors = this.actors.filter((x) => x !== a);
      }
    }
    for (const d of this.decals) d.ttl -= dt;
    this.decals = this.decals.filter((d) => d.ttl > 0);
    for (const f of this.flyers) {
      animator.advance(f.id, f.sprite, f.clip, dt, 1);
      f.t += dt;
      if (f.t >= f.dur) f.onArrive?.();
    }
    for (const f of [...this.flyers]) {
      if (f.t >= f.dur) {
        animator.remove(f.id);
        this.flyers = this.flyers.filter((x) => x !== f);
      }
    }
    void assets;
  }

  /** Draw in the effect layer: decals below, particles, then actors. */
  render(ctx: CanvasRenderingContext2D, animator: Animator, assets: AssetManager): void {
    for (const d of this.decals) {
      const a = Math.min(0.45, (d.ttl / d.maxTtl) * 0.45);
      ctx.fillStyle = 'rgba(30,22,12,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.rx, d.rx * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of this.particles) {
      const frac = Math.max(0, Math.min(1, p.ttl / p.maxTtl));
      ctx.globalAlpha = Math.min(1, frac * 1.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.kind === 'spark') {
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * frac), 0, Math.PI * 2);
      } else {
        ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1.6 - 0.6 * frac : 0.5 + 0.5 * frac), 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const a of this.actors) {
      const fade = Math.min(1, (a.ttl / a.maxTtl) * 2.5);
      drawSpriteFrame(ctx, assets, a.sprite, animator.frameOf(a.id), a.x, a.y, {
        alpha: fade,
        scale: a.scale,
        flipX: a.flipX,
      });
    }
    for (const f of this.flyers) {
      const p = Math.min(1, f.t / f.dur);
      const e = 1 - (1 - p) * (1 - p); // ease-out
      const x = f.fromX + (f.toX - f.fromX) * e;
      const y = f.fromY + (f.toY - f.fromY) * e - Math.sin(p * Math.PI) * 46; // arc
      drawSpriteFrame(ctx, assets, f.sprite, animator.frameOf(f.id), x, y, { scale: f.scale });
    }
  }

  clear(): void {
    this.particles.length = 0;
    this.actors.length = 0;
    this.decals.length = 0;
    this.flyers.length = 0;
  }
}
