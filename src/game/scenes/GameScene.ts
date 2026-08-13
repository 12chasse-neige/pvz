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
import type { FxState, Position, SunC } from '../components';
import type { GameEvents, LevelStats } from '../events';
import { burst, makePlant, spawnFloater } from '../factory';
import { setupWorld } from '../setup';
import type { WorldSetup } from '../setup';
import type { GameState } from '../state';
import type { LevelDef, PlantKind } from '../content';
import { PLANTS } from '../content';
import { createBackground } from '../render/background';
import { drawIcon, paintEntity } from '../render/painters';
import { HUD } from '../ui/hud';
import { save } from '../save';
import { MenuScene } from './MenuScene';
import { ResultScene } from './ResultScene';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * The playable level scene: owns the world + HUD, forwards input intents
 * (plant, dig, collect sun) into the simulation, and renders the board.
 */
export class GameScene implements Scene<GameEvents> {
  name = 'game';
  private ctx!: SceneContext<GameEvents>;
  private setup!: WorldSetup;
  private world!: World;
  private state!: GameState;
  private hud!: HUD;
  private bg!: HTMLCanvasElement;
  private hover: { col: number; row: number } | null = null;
  private timers = new Timers();
  private unsubs: (() => void)[] = [];
  private over = false;
  private pauseEl: HTMLDivElement | null = null;

  constructor(
    private readonly level: LevelDef,
    private readonly seed: number,
  ) {}

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.bg = createBackground();
    this.setup = setupWorld(this.level, this.seed, ctx.events);
    this.world = this.setup.world;
    this.state = this.setup.state;

    const muted = save.load().muted;
    this.hud = new HUD(
      ctx.view.uiInner,
      this.level,
      this.state,
      {
        onSelect: (kind) => this.selectSeed(kind),
        onShovel: () => this.toggleShovel(),
        onPause: () => ctx.sm.setPaused(true),
        onMute: () => {
          const data = save.load();
          data.muted = !data.muted;
          save.write(data);
          ctx.audio.setMuted(data.muted);
          this.hud.setMuted(data.muted);
        },
      },
      this.setup.waveTimes,
      this.setup.totalTime,
      muted,
    );

    ctx.input.onDown = this.handleDown;
    ctx.input.onMove = this.handleMove;

    const events = ctx.events;
    this.unsubs.push(events.on('level-won', () => this.finish(true)));
    this.unsubs.push(events.on('level-lost', () => this.finish(false)));
    this.unsubs.push(
      events.on('wave-started', (w) => {
        if (w.flag) this.hud.showBanner('A huge wave of zombies is approaching!');
      }),
    );
    this.unsubs.push(
      events.on('projectile-fired', (p) => {
        if (p.kind === 'frozen') ctx.audio.frozenShoot();
        else ctx.audio.shoot();
      }),
    );
    this.unsubs.push(events.on('plant-placed', () => ctx.audio.plant()));
    this.unsubs.push(events.on('plant-removed', () => ctx.audio.dig()));
    this.unsubs.push(events.on('sun-collected', () => ctx.audio.sun()));
    this.unsubs.push(events.on('explosion', () => ctx.audio.explosion()));
    this.unsubs.push(events.on('mower-triggered', () => ctx.audio.mower()));
    this.unsubs.push(events.on('zombie-killed', () => ctx.audio.zombieGroan()));

    this.hud.showBanner(this.level.name + ': defend the house!');
  }

  onExit(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.ctx.input.onDown = null;
    this.ctx.input.onMove = null;
    this.hud.destroy();
    this.hidePause();
  }

  update(dt: number): void {
    this.timers.update(dt);
    this.world.update(dt);
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

  render(_alpha: number): void {
    const view = this.ctx.view;
    const ctx = view.ctx;
    ctx.clearRect(0, 0, view.logicalW, view.logicalH);
    const fx = this.world.resources.fx as FxState;
    ctx.save();
    if (fx.shake > 0.001) {
      ctx.translate((Math.random() - 0.5) * fx.shake * 14, (Math.random() - 0.5) * fx.shake * 14);
    }
    ctx.drawImage(this.bg, 0, 0);
    this.drawHover(ctx);
    const ents = this.world.query('Renderable', 'Position');
    ents.sort((a, b) => {
      const pa = this.world.get<Position>(a, 'Position')!;
      const pb = this.world.get<Position>(b, 'Position')!;
      return pa.y - pb.y;
    });
    for (const e of ents) paintEntity(ctx, this.world, e);
    for (const f of fx.floaters) {
      ctx.globalAlpha = Math.min(1, (f.ttl / f.maxTtl) * 1.5);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
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
      burst(this.world, p.x, p.y, '#ffe14d', 8, 130);
      spawnFloater(this.world, p.x, p.y - 16, '+' + s.value);
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cellLeft(h.col) + 1, cellTop(h.row) + 1, CELL_W - 2, CELL_H - 2);
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
    ctx.fillStyle = can ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 60, 60, 0.18)';
    ctx.fillRect(x, y, CELL_W, CELL_H);
    ctx.globalAlpha = 0.7;
    ctx.save();
    ctx.translate(cellCenterX(cell.col), cellCenterY(cell.row));
    ctx.scale(2.1, 2.1);
    drawIcon(ctx, kind);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---------- flow ---------- */

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    const stats: LevelStats = {
      kills: this.state.kills,
      sun: this.state.sunCollected,
      time: Math.round(this.state.elapsed),
    };
    if (won) {
      this.ctx.audio.win();
      for (let i = 0; i < 4; i++) {
        burst(this.world, LAWN_LEFT + Math.random() * LAWN_W, 100 + Math.random() * 380, '#ffe14d', 12, 150);
      }
    } else {
      this.ctx.audio.lose();
    }
    this.timers.after(1.8, () => {
      this.ctx.sm.setPaused(false);
      this.ctx.sm.replace(new ResultScene(this.level, won, stats));
    });
  }

  private showPause(): void {
    if (this.pauseEl) return;
    const el = document.createElement('div');
    el.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const title = document.createElement('h2');
    title.textContent = 'Paused';
    const row = document.createElement('div');
    row.className = 'btn-row';
    const resume = document.createElement('button');
    resume.className = 'btn';
    resume.textContent = 'Resume';
    resume.addEventListener('click', () => this.ctx.sm.setPaused(false));
    const restart = document.createElement('button');
    restart.className = 'btn secondary';
    restart.textContent = 'Restart';
    restart.addEventListener('click', () => {
      this.ctx.sm.setPaused(false);
      this.ctx.sm.replace(new GameScene(this.level, randomSeed()));
    });
    const quit = document.createElement('button');
    quit.className = 'btn secondary';
    quit.textContent = 'Main Menu';
    quit.addEventListener('click', () => {
      this.ctx.sm.setPaused(false);
      this.ctx.sm.replace(new MenuScene());
    });
    row.append(resume, restart, quit);
    panel.append(title, row);
    el.appendChild(panel);
    this.ctx.view.uiInner.appendChild(el);
    this.pauseEl = el;
  }

  private hidePause(): void {
    this.pauseEl?.remove();
    this.pauseEl = null;
  }
}
