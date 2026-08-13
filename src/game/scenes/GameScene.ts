import type { Scene, SceneContext } from '../../core/SceneManager';
import type { World } from '../../core/ecs/World';
import { Timers } from '../../core/Timers';
import { dist2 } from '../../core/math';
import {
  CELL_H,
  CELL_W,
  LAWN_LEFT,
  LAWN_W,
  SUN_COLLECT_RADIUS,
  cellCenterX,
  cellCenterY,
  cellLeft,
  cellTop,
  pixelToCell,
} from '../config';
import type { Health, MowerC, Position, SunC } from '../components';
import type { GameEvents, LevelStats } from '../events';
import { burst, makePlant, makeZombie, spawnFloater } from '../factory';
import { setupWorld } from '../setup';
import type { WorldSetup } from '../setup';
import type { GameState } from '../state';
import type { LevelDef, PlantKind } from '../content';
import { PLANTS } from '../content';
import { HUD } from '../ui/hud';
import { drawSeedPortrait } from '../ui/icons';
import { save } from '../save';
import { Animator } from '../anim/playback';
import { Battlefield } from '../render/battlefield';
import type { LightingState } from '../render/battlefield';
import { CameraState } from '../render/camera';
import { CosmeticFx } from '../render/fx';
import { paintEntity, updateAnimator } from '../render/renderer';
import type { RenderCtx } from '../render/renderer';
import { ZOMBIE_SPRITES } from '../anim/resolver';
import { QualityManager } from '../render/quality';
import type { MarkerEvent } from '../anim/playback';
import { MenuScene } from './MenuScene';
import { ResultScene } from './ResultScene';
import { Rng } from '../../core/Rng';
import { RENDER_PROFILES } from '../anim/types';
import type { RenderTier } from '../anim/types';
import type { DebugPlantPatch, DebugZombiePatch } from '../debug';
import { PREV_POSITION } from '../render/history';
import { ZOMBIES } from '../content';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Deterministic screenshot/perf boot options (never used in normal play). */
export interface GameSceneOptions {
  fixedT?: number;
  forcedTier?: RenderTier;
  reducedMotion?: boolean;
  plants?: DebugPlantPatch[];
  zombies?: DebugZombiePatch[];
  wallnutHpFrac?: number;
  cherryFuse?: number;
}

/**
 * The playable level scene: owns the world + HUD, forwards input intents
 * (plant, dig, collect sun) into the simulation, and renders the layered
 * battlefield with sprite entities, interpolated motion, trauma camera,
 * cosmetic FX and adaptive quality.
 */
export class GameScene implements Scene<GameEvents> {
  name = 'game';
  private ctx!: SceneContext<GameEvents>;
  private setup!: WorldSetup;
  private world!: World;
  private state!: GameState;
  private hud!: HUD;
  private hover: { col: number; row: number } | null = null;
  private timers = new Timers();
  private unsubs: (() => void)[] = [];
  private over = false;
  private pauseEl: HTMLDivElement | null = null;

  // presentation
  private battlefield!: Battlefield;
  private camera!: CameraState;
  private quality!: QualityManager;
  private fx!: CosmeticFx;
  private animator!: Animator;
  private lighting: LightingState = { warm: 0, alert: 0, flash: 0 };
  private displaySun = 0;
  private lastRenderMs = 0;
  private rctx!: RenderCtx;
  private debugFrozen = false;
  private debugAlpha = 1;
  private debugPending = false;
  private readonly debugRng: Rng;
  private stats = { fps: 0, particles: 0, actors: 0, entities: 0, tier: 'high' };

  constructor(
    private readonly level: LevelDef,
    private readonly seed: number,
    private readonly opts?: GameSceneOptions,
  ) {
    this.debugRng = new Rng((seed ^ 0x5bf03635) >>> 0);
  }

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.debugPending = this.opts?.fixedT !== undefined;
    const settings = save.load();
    const reducedMotion =
      this.opts?.reducedMotion ??
      (settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    this.battlefield = new Battlefield(ctx.assets);
    this.battlefield.refreshFromAssets();
    this.camera = new CameraState(this.seed ^ 0x9e3779b9, reducedMotion);
    this.quality = new QualityManager({
      dpr: window.devicePixelRatio || 1,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      reducedMotion,
    });
    if (this.opts?.forcedTier) {
      Object.assign(this.quality.profile, RENDER_PROFILES[this.opts.forcedTier]);
    }
    this.quality.onChange = (p) => {
      ctx.view.dprCap = p.dprCap;
      ctx.view.resize();
      this.fx.setCap(p.particleCap);
    };
    ctx.view.dprCap = this.quality.profile.dprCap;
    ctx.view.resize();
    this.fx = new CosmeticFx(this.quality.profile.particleCap, () => this.debugRng.next());
    this.animator = new Animator((s) => ctx.assets.getSprite(s));
    this.rctx = {
      ctx: ctx.view.ctx,
      assets: ctx.assets,
      animator: this.animator,
      fx: this.fx,
      battlefield: this.battlefield,
      quality: this.quality.profile,
      lighting: this.lighting,
      alpha: 1,
    };

    this.setup = setupWorld(this.level, this.seed, ctx.events);
    this.world = this.setup.world;
    this.state = this.setup.state;
    this.displaySun = this.state.sun;

    const audio = settings.audio;
    this.hud = new HUD(
      ctx.view.uiInner,
      ctx.assets,
      this.level,
      this.state,
      {
        onSelect: (kind) => this.selectSeed(kind),
        onShovel: () => this.toggleShovel(),
        onPause: () => ctx.sm.setPaused(true),
        onMute: () => {
          const data = save.load();
          data.audio.muted = !data.audio.muted;
          save.write(data);
          ctx.audio.setMuted(data.audio.muted);
          this.hud.setMuted(data.audio.muted);
        },
      },
      this.setup.waveTimes,
      this.setup.totalTime,
      audio.muted,
    );
    this.hud.setSun(this.displaySun);

    ctx.input.onDown = this.handleDown;
    ctx.input.onMove = this.handleMove;

    const events = ctx.events;
    this.unsubs.push(events.on('level-won', () => this.finish(true)));
    this.unsubs.push(events.on('level-lost', () => this.finish(false)));
    this.unsubs.push(
      events.on('wave-started', (w) => {
        if (w.flag) {
          this.hud.showBanner('A huge wave of zombies is approaching!', 'wave');
          this.lighting.alert = 0.55;
          this.timers.after(2.4, () => (this.lighting.alert = 0));
          ctx.audio.waveHorn();
          ctx.audio.setIntensity(1);
          this.timers.after(8, () => ctx.audio.setIntensity(0));
        }
      }),
    );
    this.unsubs.push(
      events.on('projectile-fired', (p) => {
        if (p.kind === 'frozen') ctx.audio.frozenShoot();
        else ctx.audio.shoot();
      }),
    );
    this.unsubs.push(
      events.on('projectile-hit', (p) => {
        if (p.kind === 'frozen') {
          // ice shards + breath vapor on frozen hits
          this.fx.burst(p.x, p.y, '#cfeaff', this.quality.scaleParticles(6), 130, 'shard', 1, 90);
          for (let i = 0; i < 3; i++) {
            this.fx.spawn({
              x: p.x + 4,
              y: p.y - 6 - i * 4,
              vx: 8,
              vy: -18 - i * 6,
              ttl: 0.8,
              maxTtl: 0.8,
              size: 4 + i,
              color: 'rgba(255,255,255,0.75)',
              gravity: -12,
              kind: 'smoke',
              priority: 0,
            });
          }
          ctx.audio.armorHit();
        } else {
          this.fx.burst(p.x, p.y, '#a8e860', this.quality.scaleParticles(5), 120, 'dot', 1, 140);
          this.fx.burst(p.x, p.y, '#5f9e46', this.quality.scaleParticles(3), 60, 'dot', 0, 200);
        }
      }),
    );
    this.unsubs.push(events.on('plant-placed', () => ctx.audio.plant()));
    this.unsubs.push(events.on('plant-removed', () => ctx.audio.dig()));
    this.unsubs.push(events.on('sun-collected', () => ctx.audio.sun()));
    this.unsubs.push(
      events.on('explosion', (ev) => {
        this.camera.addTrauma(0.55);
        this.lighting.flash = 0.5;
        this.fx.burst(ev.x, ev.y, '#ffb14d', this.quality.scaleParticles(26), 240, 'spark', 1, 120);
        this.fx.burst(ev.x, ev.y, '#8a8a86', this.quality.scaleParticles(10), 60, 'smoke', 0, 40);
        this.fx.addScorch(ev.x, ev.y + 10, 46);
        this.fx.spawnActor('blast', 'boom', ev.x, ev.y, 0.5, 1.35);
        ctx.audio.explosion();
      }),
    );
    this.unsubs.push(
      events.on('mower-triggered', () => {
        this.camera.addTrauma(0.3);
        ctx.audio.mower();
      }),
    );
    this.unsubs.push(
      events.on('zombie-killed', (ev) => {
        ctx.audio.zombieGroan();
        const v = ZOMBIE_SPRITES[ev.kind];
        this.fx.spawnActor(v.sprite, 'death', ev.x, ev.y, 1.5, v.scale);
      }),
    );

    this.hud.showBanner(this.level.name + ': defend the house!', 'info');
    ctx.audio.playMusic('game');

    // Deterministic screenshot boot: fast-forward to fixedT, apply patches,
    // settle one step, then freeze the simulation. Live perf scenes apply
    // patches but keep playing.
    const hasPatch =
      this.opts &&
      (this.opts.plants || this.opts.zombies || this.opts.wallnutHpFrac !== undefined || this.opts.cherryFuse !== undefined);
    if (this.opts?.fixedT !== undefined) {
      const steps = Math.floor(this.opts.fixedT / (1 / 60));
      for (let i = 0; i < steps; i++) this.step(1 / 60);
      this.applyDebugPatch();
      this.step(1 / 60);
      this.debugFrozen = true;
      this.debugAlpha = 0.5;
    } else if (hasPatch) {
      this.applyDebugPatch();
      this.step(1 / 60);
    }
    (window as unknown as Record<string, unknown>).__PVZ_STATS__ = this.stats;
    (window as unknown as Record<string, unknown>).__PVZ_DEBUG_INFO__ = {
      hasOpts: !!this.opts,
      fixedT: this.opts?.fixedT,
      plantsLen: this.opts?.plants?.length ?? 0,
      zombiesLen: this.opts?.zombies?.length ?? 0,
      entities: this.world.entityCount(),
    };
    // Deterministic quality-driver hook for the performance acceptance test.
    (window as unknown as Record<string, unknown>).__PVZ_QUALITY__ = {
      sample: (ms: number, n: number) => {
        for (let i = 0; i < n; i++) this.quality.sampleFrame(ms);
      },
      tier: () => this.quality.tier,
    };
  }

  /** One deterministic simulation step (world + presentation clocks). */
  private step(dt: number): void {
    this.timers.update(dt);
    this.world.update(dt);
    updateAnimator(this.world, dt, this.animator, this.ctx.assets, (e, kind, marker) =>
      this.onMarker(e, kind, marker),
    );
    this.fx.update(dt, this.animator, this.ctx.assets);
    this.camera.update(dt);
    this.lighting.warm = Math.max(0, this.lighting.warm - dt * 0.6);
    this.lighting.flash = Math.max(0, this.lighting.flash - dt * 2.2);

    // sun display: spends update instantly, gains fly to the counter first
    if (this.state.sun < this.displaySun) {
      this.displaySun = this.state.sun;
      this.hud.setSun(this.displaySun);
    }
  }

  /** Inject debug entities after the fast-forward (screenshot setups). */
  private applyDebugPatch(): void {
    const o = this.opts;
    if (!o) return;
    const t = this.world.resources.time as number;
    for (const raw of o.plants ?? []) {
      const [kindName, col, row] = Array.isArray(raw) ? raw : [raw.kind, raw.col, raw.row];
      const kind = kindName as PlantKind;
      if (!PLANTS[kind]) continue;
      const e = makePlant(this.world, kind, col, row);
      this.setup.grid[col]![row] = e;
      if (kind === 'wallnut' && o.wallnutHpFrac !== undefined) {
        const h = this.world.get<Health>(e, 'Health')!;
        h.hp = h.max * o.wallnutHpFrac;
      }
      if (kind === 'cherrybomb' && o.cherryFuse !== undefined) {
        const f = this.world.get<{ time: number }>(e, 'Fuse');
        if (f) f.time = o.cherryFuse;
      }
    }
    for (const z of o.zombies ?? []) {
      const def = ZOMBIES[z.kind];
      const e = makeZombie(this.world, z.kind, z.row, this.debugRng);
      const pos = this.world.get<Position>(e, 'Position')!;
      pos.x = z.x;
      const prev = this.world.get<Position>(e, PREV_POSITION);
      if (prev) prev.x = z.x;
      if (z.hpFrac !== undefined) {
        const h = this.world.get<Health>(e, 'Health')!;
        h.hp = h.max * z.hpFrac;
      }
      if (z.slowed) {
        const b = this.world.get<{ slowUntil: number }>(e, 'ZombieBrain')!;
        b.slowUntil = t + 5;
      }
      void def;
    }
  }

  onExit(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.ctx.input.onDown = null;
    this.ctx.input.onMove = null;
    this.hud.destroy();
    this.hidePause();
    this.ctx.audio.stopMusic();
    this.ctx.audio.mowerStop();
  }

  update(dt: number): void {
    if (this.debugFrozen) return;
    this.step(dt);

    // mower engine loop while any mower is active
    const anyActive = this.world
      .query('MowerC')
      .some((e) => this.world.get<MowerC>(e, 'MowerC')?.active);
    if (anyActive) this.ctx.audio.mowerStart();
    else this.ctx.audio.mowerStop();

    this.hud.update(this.state);
    this.hud.setProgress(this.state.elapsed / this.setup.totalTime);

    const jp = this.ctx.input.justPressed;
    const allowed = this.level.allowedPlants;
    for (let i = 0; i < 5; i++) {
      const key = String(i + 1);
      if (jp.has(key) && allowed[i]) this.selectSeed(allowed[i]!);
    }
    if (jp.has('s')) this.toggleShovel();
  }

  private onMarker(e: number, kind: string, marker: MarkerEvent): void {
    const p = this.world.get<Position>(e, 'Position');
    if (!p) return;
    const groundY = kind === 'zombie' ? 40 : 26;
    switch (marker.event) {
      case 'muzzle':
        this.fx.burst(p.x + 30, p.y + groundY - 14, '#fff6c8', 3, 60, 'spark', 1, 40);
        break;
      case 'footstep':
        this.fx.burst(p.x, p.y + groundY - 2, '#cbbf9a', 1, 22, 'dot', 0, 120);
        break;
      case 'bite': {
        this.ctx.audio.chomp();
        // leaf/shell debris flies off the bitten plant
        const brain = this.world.get<{ target: number | null }>(e, 'ZombieBrain');
        const target = brain?.target ?? null;
        if (target !== null) {
          const tp = this.world.get<Position>(target, 'Position');
          if (tp) {
            this.fx.burst(tp.x, tp.y - 14, '#7ec850', this.quality.scaleParticles(3), 70, 'dot', 0, 220);
            this.fx.burst(tp.x, tp.y - 8, '#3fae3f', this.quality.scaleParticles(2), 50, 'dot', 0, 240);
          }
        }
        break;
      }
      case 'sunburst':
        this.fx.burst(p.x, p.y + groundY - 20, '#ffe14d', this.quality.scaleParticles(8), 90, 'spark', 1, 60);
        break;
      case 'clip':
        this.fx.burst(p.x - 20, p.y + 26, '#7ec850', this.quality.scaleParticles(2), 80, 'dot', 0, 260);
        break;
      case 'exhaust':
        this.fx.spawn({
          x: p.x - 26,
          y: p.y + 16,
          vx: -14,
          vy: -16,
          ttl: 0.9,
          maxTtl: 0.9,
          size: 5,
          color: 'rgba(200,200,196,0.6)',
          gravity: -10,
          kind: 'smoke',
          priority: 0,
        });
        break;
      default:
        break;
    }
  }

  render(alpha: number): void {
    if (this.debugFrozen) alpha = this.debugAlpha;
    // adaptive quality: feed the rolling frame-time average
    const now = performance.now();
    if (this.lastRenderMs > 0) this.quality.sampleFrame(now - this.lastRenderMs);
    this.lastRenderMs = now;
    // live stats for the performance acceptance scenes
    this.stats.fps = this.lastRenderMs > 0 ? Math.min(240, Math.round(1000 / Math.max(1, now - this.lastRenderMs))) : 0;
    this.stats.particles = this.fx.particleCount;
    this.stats.actors = this.fx.actorCount;
    this.stats.entities = this.world.entityCount();
    this.stats.tier = this.quality.tier;

    const view = this.ctx.view;
    const ctx = view.ctx;
    ctx.clearRect(0, 0, view.logicalW, view.logicalH);

    // trauma camera (seeded noise, reduced-motion aware)
    const cam = this.camera.offset();
    ctx.save();
    ctx.translate(view.logicalW / 2, view.logicalH / 2);
    ctx.rotate(cam.rot);
    ctx.translate(-view.logicalW / 2 + cam.x, -view.logicalH / 2 + cam.y);

    const t = this.world.resources.time as number;
    this.battlefield.drawBack(ctx, t, this.quality.profile);
    this.drawHover(ctx);
    const ents = this.world.query('Renderable', 'Position');
    ents.sort((a, b) => {
      const pa = this.world.get<Position>(a, 'Position')!;
      const pb = this.world.get<Position>(b, 'Position')!;
      return pa.y - pb.y;
    });
    this.rctx.alpha = alpha;
    this.rctx.ctx = ctx;
    for (const e of ents) paintEntity(this.rctx, this.world, e);
    this.fx.render(ctx, this.animator, this.ctx.assets);
    this.drawFloaters(ctx);
    this.battlefield.drawFront(ctx, t);
    ctx.restore();

    // screen-space lighting pass
    this.battlefield.drawLighting(ctx, this.lighting);

    if (
      (this.state.selected || this.state.shovel) &&
      this.hover &&
      (this.state.phase === 'play' || this.state.phase === 'prepare')
    ) {
      this.drawGhost(ctx);
    }
  }

  onPauseChange(paused: boolean): void {
    if (paused && !this.over) this.showPause();
    else this.hidePause();
  }

  /* ---------- input ---------- */

  private handleDown = (e: PointerEvent): void => {
    if (e.target !== this.ctx.view.canvas) return;
    if (this.over) return;
    const st = this.state;
    if (st.phase !== 'prepare' && st.phase !== 'play') return;
    const g = this.ctx.view.screenToGame(e.clientX, e.clientY);
    if (st.shovel) {
      const cell = pixelToCell(g.x, g.y);
      if (cell) this.removePlant(cell);
      st.shovel = false;
      this.hud.update(st);
      return;
    }
    if (this.tryCollectSun(g.x, g.y)) return;
    if (st.selected) {
      const cell = pixelToCell(g.x, g.y);
      if (cell) this.tryPlant(cell);
      else {
        st.selected = null;
        this.hud.update(st);
      }
    }
  };

  private handleMove = (e: PointerEvent): void => {
    const g = this.ctx.view.screenToGame(e.clientX, e.clientY);
    this.hover = pixelToCell(g.x, g.y);
  };

  private selectSeed(kind: PlantKind): void {
    const st = this.state;
    if (st.phase !== 'prepare' && st.phase !== 'play') return;
    if (st.shovel) st.shovel = false;
    st.selected = st.selected === kind ? null : kind;
    this.ctx.audio.seedSelect();
    this.hud.update(st);
  }

  private toggleShovel(): void {
    const st = this.state;
    if (st.phase !== 'prepare' && st.phase !== 'play') return;
    st.shovel = !st.shovel;
    if (st.shovel) st.selected = null;
    this.ctx.audio.seedSelect();
    this.hud.update(st);
  }

  private tryPlant(cell: { col: number; row: number }): void {
    const st = this.state;
    const kind = st.selected!;
    const def = PLANTS[kind];
    const grid = this.setup.grid;
    const occupied = grid[cell.col]![cell.row] !== null;
    const recharging = st.recharges[kind] > 0;
    if (occupied || recharging || st.sun < def.cost) {
      this.ctx.audio.seedDenied();
      st.selected = null;
      this.hud.update(st);
      return;
    }
    st.sun -= def.cost;
    st.recharges[kind] = def.recharge;
    const e = makePlant(this.world, kind, cell.col, cell.row);
    grid[cell.col]![cell.row] = e;
    burst(this.world, cellCenterX(cell.col), cellCenterY(cell.row) + 12, '#8a6a3a', 6, 80);
    this.fx.burst(cellCenterX(cell.col), cellCenterY(cell.row) + 20, '#7ec850', 6, 70, 'dot', 0, 160);
    this.ctx.events.emit('plant-placed', { kind, col: cell.col, row: cell.row });
    st.selected = null;
    this.hud.update(st);
  }

  private removePlant(cell: { col: number; row: number }): void {
    const grid = this.setup.grid;
    const e = grid[cell.col]![cell.row];
    if (!e) return;
    grid[cell.col]![cell.row] = null;
    this.world.destroy(e);
    burst(this.world, cellCenterX(cell.col), cellCenterY(cell.row), '#7ec850', 8, 90);
    this.ctx.events.emit('plant-removed', { col: cell.col, row: cell.row });
  }

  private tryCollectSun(x: number, y: number): boolean {
    for (const e of this.world.query('SunC')) {
      const p = this.world.get<Position>(e, 'Position');
      if (!p) continue;
      if (dist2(p.x, p.y, x, y) > SUN_COLLECT_RADIUS * SUN_COLLECT_RADIUS) continue;
      const s = this.world.get<SunC>(e, 'SunC')!;
      const st = this.state;
      st.sun += s.value;
      st.sunCollected += s.value;
      this.fx.burst(p.x, p.y, '#ffe14d', 8, 130, 'spark', 1, 60);
      spawnFloater(this.world, p.x, p.y - 16, '+' + s.value);
      this.fx.spawnFlyer('sun', 'pulse', p.x, p.y, 58, 40, 0.38, 0.72, () => {
        this.displaySun = this.state.sun;
        this.hud.setSun(this.displaySun, true);
      });
      this.world.destroy(e);
      this.ctx.events.emit('sun-collected', { value: s.value, total: st.sun });
      this.hud.update(st);
      return true;
    }
    return false;
  }

  /* ---------- rendering helpers ---------- */

  private drawHover(ctx: CanvasRenderingContext2D): void {
    if (!this.hover) return;
    const h = this.hover;
    const x = cellLeft(h.col);
    const y = cellTop(h.row);
    ctx.fillStyle = 'rgba(255,252,200,0.10)';
    ctx.beginPath();
    ctx.ellipse(cellCenterX(h.col), cellCenterY(h.row) + 4, 34, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
    ctx.setLineDash([]);
  }

  private drawGhost(ctx: CanvasRenderingContext2D): void {
    const cell = this.hover!;
    const x = cellLeft(cell.col);
    const y = cellTop(cell.row);
    if (this.state.shovel) {
      ctx.fillStyle = 'rgba(255, 90, 90, 0.22)';
      ctx.fillRect(x, y, CELL_W, CELL_H);
      return;
    }
    const kind = this.state.selected!;
    const def = PLANTS[kind];
    const grid = this.setup.grid;
    const can =
      grid[cell.col]![cell.row] === null &&
      this.state.sun >= def.cost &&
      this.state.recharges[kind] <= 0;
    ctx.fillStyle = can ? 'rgba(255,255,255,0.15)' : 'rgba(255,60,60,0.18)';
    ctx.fillRect(x, y, CELL_W, CELL_H);
    ctx.globalAlpha = 0.85;
    ctx.save();
    ctx.translate(cellCenterX(cell.col), cellCenterY(cell.row) - 6);
    ctx.scale(1.6, 1.6);
    drawSeedPortrait(ctx, this.ctx.assets, kind);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    const fxState = this.world.resources.fx as { floaters: { x: number; y: number; text: string; color: string; ttl: number; maxTtl: number }[] };
    for (const f of fxState.floaters) {
      ctx.globalAlpha = Math.min(1, (f.ttl / f.maxTtl) * 1.5);
      ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(30,24,10,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- flow ---------- */

  private finish(won: boolean): void {
    if (this.over || this.debugPending) return;
    this.over = true;
    const stats: LevelStats = {
      kills: this.state.kills,
      sun: this.state.sunCollected,
      time: Math.round(this.state.elapsed),
    };
    this.ctx.audio.stopMusic();
    if (won) {
      this.ctx.audio.win();
      this.lighting.warm = 1;
      for (let i = 0; i < 4; i++) {
        this.fx.burst(LAWN_LEFT + Math.random() * LAWN_W, 100 + Math.random() * 380, '#ffe14d', 12, 150, 'spark', 0, 60);
      }
    } else {
      this.ctx.audio.lose();
      this.lighting.alert = 0.6;
      this.camera.addTrauma(0.4);
    }
    this.timers.after(1.8, () => {
      this.ctx.sm.setPaused(false);
      this.ctx.sm.replaceFaded(new ResultScene(this.level, won, stats), 350);
    });
  }

  private showPause(): void {
    if (this.pauseEl) return;
    const el = document.createElement('div');
    el.className = 'overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Game paused');
    const panel = document.createElement('div');
    panel.className = 'panel shed-panel';
    const title = document.createElement('h2');
    title.textContent = 'Paused';
    const row = document.createElement('div');
    row.className = 'btn-row';
    const resume = document.createElement('button');
    resume.className = 'btn';
    resume.textContent = 'Resume';
    resume.setAttribute('aria-label', 'Resume game');
    resume.addEventListener('click', () => this.ctx.sm.setPaused(false));
    const restart = document.createElement('button');
    restart.className = 'btn secondary';
    restart.textContent = 'Restart';
    restart.setAttribute('aria-label', 'Restart level');
    restart.addEventListener('click', () => {
      this.ctx.sm.setPaused(false);
      this.ctx.sm.replaceFaded(new GameScene(this.level, randomSeed()), 300);
    });
    const quit = document.createElement('button');
    quit.className = 'btn secondary';
    quit.textContent = 'Main Menu';
    quit.setAttribute('aria-label', 'Return to main menu');
    quit.addEventListener('click', () => {
      this.ctx.sm.setPaused(false);
      this.ctx.sm.replaceFaded(new MenuScene(), 300);
    });
    row.append(resume, restart, quit);
    panel.append(title, row);
    panel.append(this.buildOptions());
    el.appendChild(panel);
    this.ctx.view.uiInner.appendChild(el);
    this.pauseEl = el;
  }

  /** Sound/accessibility toggles in the pause panel. */
  private buildOptions(): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'options-box';
    const mk = (label: string, on: boolean, fn: () => void): HTMLLabelElement => {
      const l = document.createElement('label');
      l.className = 'option-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = on;
      input.addEventListener('change', fn);
      const span = document.createElement('span');
      span.textContent = label;
      l.append(input, span);
      return l;
    };
    box.appendChild(
      mk('Music', save.load().audio.musicOn, () => {
        const d = save.load();
        d.audio.musicOn = !d.audio.musicOn;
        save.write(d);
        this.ctx.audio.setSettings(d.audio);
      }),
    );
    box.appendChild(
      mk('Sound effects', save.load().audio.effectsOn, () => {
        const d = save.load();
        d.audio.effectsOn = !d.audio.effectsOn;
        save.write(d);
        this.ctx.audio.setSettings(d.audio);
      }),
    );
    box.appendChild(
      mk('High contrast', save.load().highContrast, () => {
        const d = save.load();
        d.highContrast = !d.highContrast;
        save.write(d);
        document.body.classList.toggle('high-contrast', d.highContrast);
      }),
    );
    box.appendChild(
      mk('Reduced motion', save.load().reducedMotion, () => {
        const d = save.load();
        d.reducedMotion = !d.reducedMotion;
        save.write(d);
        this.camera.reducedMotion = d.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }),
    );
    return box;
  }

  private hidePause(): void {
    this.pauseEl?.remove();
    this.pauseEl = null;
  }
}
