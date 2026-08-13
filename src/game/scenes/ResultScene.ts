import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import type { LevelStats } from '../events';
import type { LevelDef } from '../content';
import { LEVELS } from '../content';
import { recordResult } from '../save';
import { Battlefield } from '../render/battlefield';
import { Animator } from '../anim/playback';
import { drawSpriteFrame } from '../render/sprites';
import { paintSunflower } from '../render/painters';
import { GameScene } from './GameScene';
import { LevelSelectScene } from './LevelSelectScene';
import { MenuScene } from './MenuScene';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * Victory / defeat screen: results count upward, plants celebrate under a
 * warm sweep on victory; defeat shows a zombie silhouette over a
 * desaturated lawn. Progression unlocks visibly.
 */
export class ResultScene implements Scene<GameEvents> {
  name = 'result';
  private ctx!: SceneContext<GameEvents>;
  private battlefield!: Battlefield;
  private root!: HTMLDivElement;
  private animator!: Animator;
  private t = 0;
  private display = { kills: 0, sun: 0, time: 0 };
  private counts: { kills: HTMLElement; sun: HTMLElement; time: HTMLElement } | null = null;

  constructor(
    private readonly level: LevelDef,
    private readonly won: boolean,
    private readonly stats: LevelStats,
  ) {}

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.battlefield = new Battlefield(ctx.assets);
    this.battlefield.refreshFromAssets();
    this.animator = new Animator((s) => ctx.assets.getSprite(s));
    const levelIndex = LEVELS.indexOf(this.level);
    if (this.won) recordResult(levelIndex, this.stats.kills, this.stats.time);
    const hasNext = this.won && levelIndex + 1 < LEVELS.length;

    const root = document.createElement('div');
    root.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel result-panel';

    const title = document.createElement('h1');
    title.textContent = this.won ? 'The Garden Holds!' : 'The Zombies Got Through…';
    title.className = this.won ? 'result-win' : 'result-lose';

    const statsEl = document.createElement('div');
    statsEl.className = 'stats';
    const mk = (label: string): { label: HTMLElement; value: HTMLElement } => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const l = document.createElement('span');
      l.textContent = label;
      const v = document.createElement('b');
      v.textContent = '0';
      row.append(l, v);
      statsEl.appendChild(row);
      return { label: l, value: v };
    };
    const kills = mk('Zombies defeated');
    const sun = mk('Sun collected');
    const time = mk('Time');
    this.counts = { kills: kills.value, sun: sun.value, time: time.value };

    const row = document.createElement('div');
    row.className = 'btn-row';
    if (hasNext) {
      const next = document.createElement('button');
      next.className = 'btn';
      next.textContent = 'Next Garden';
      next.setAttribute('aria-label', 'Play the next level');
      next.addEventListener('click', () => {
        ctx.audio.uiClick();
        ctx.sm.replaceFaded(new GameScene(LEVELS[levelIndex + 1]!, randomSeed()), 320);
      });
      row.appendChild(next);
    }
    const retry = document.createElement('button');
    retry.className = 'btn' + (hasNext ? ' secondary' : '');
    retry.textContent = 'Retry';
    retry.setAttribute('aria-label', 'Retry this level');
    retry.addEventListener('click', () => {
      ctx.audio.uiClick();
      ctx.sm.replaceFaded(new GameScene(this.level, randomSeed()), 320);
    });
    const select = document.createElement('button');
    select.className = 'btn secondary';
    select.textContent = 'Gardens';
    select.addEventListener('click', () => ctx.sm.replaceFaded(new LevelSelectScene(), 300));
    const menu = document.createElement('button');
    menu.className = 'btn secondary';
    menu.textContent = 'Menu';
    menu.addEventListener('click', () => ctx.sm.replaceFaded(new MenuScene(), 300));
    row.append(retry, select, menu);

    if (this.won) {
      const unlock = document.createElement('div');
      unlock.className = 'unlock-note';
      unlock.textContent = hasNext ? LEVELS[levelIndex + 1]!.name + ' unlocked!' : 'All gardens defended!';
      panel.append(title, statsEl, unlock, row);
    } else {
      panel.append(title, statsEl, row);
    }
    root.appendChild(panel);
    ctx.view.uiInner.appendChild(root);
    this.root = root;
  }

  onExit(): void {
    this.root.remove();
  }

  update(dt: number): void {
    this.t += dt;
    // results count upward over ~0.9 s
    const p = Math.min(1, this.t / 0.9);
    const ease = 1 - (1 - p) * (1 - p);
    this.display.kills = Math.round(this.stats.kills * ease);
    this.display.sun = Math.round(this.stats.sun * ease);
    this.display.time = Math.round(this.stats.time * ease);
    if (this.counts) {
      const mm = Math.floor(this.display.time / 60);
      const ss = String(this.display.time % 60).padStart(2, '0');
      this.counts.kills.textContent = String(this.display.kills);
      this.counts.sun.textContent = String(this.display.sun);
      this.counts.time.textContent = mm + ':' + ss;
    }
    // celebration animation clocks
    this.animator.advance(-1, 'peashooter', 'idle', dt, 1);
    this.animator.advance(-2, 'peashooter', 'idle', dt, 1);
    this.animator.advance(-3, 'zombie-basic', 'walk', dt, 1);
  }

  render(_alpha: number): void {
    const ctx = this.ctx.view.ctx;
    ctx.clearRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
    this.battlefield.drawBack(ctx, this.t, {
      tier: 'high',
      particleScale: 0,
      particleCap: 0,
      shadows: true,
      glow: this.won,
      ambient: true,
      ambientDensity: 0.3,
      streaks: false,
      dprCap: 2,
      fullRes: true,
    });

    if (this.won) {
      // plants celebrate, warm lighting sweeps the lawn
      const bounce = Math.abs(Math.sin(this.t * 4));
      drawSpriteFrame(ctx, this.ctx.assets, 'peashooter', this.animator.frameOf(-1), 150, 400 + bounce * 10, { scale: 0.9 });
      drawSpriteFrame(ctx, this.ctx.assets, 'peashooter', this.animator.frameOf(-2), 220, 408 + bounce * 12, { scale: 0.8, flipX: true });
      ctx.save();
      ctx.translate(640, 416 + bounce * 14);
      paintSunflower(ctx, this.t, { glow: 0.5 });
      ctx.restore();
      this.battlefield.drawLighting(ctx, { warm: 0.55 + bounce * 0.2, alert: 0, flash: 0 });
    } else {
      // desaturated lawn + zombie foreground silhouette
      ctx.fillStyle = 'rgba(70,76,66,0.42)';
      ctx.fillRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
      ctx.fillStyle = 'rgba(20,24,18,0.35)';
      ctx.fillRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
      ctx.save();
      ctx.translate(560, 560);
      ctx.scale(1.9, 1.9);
      drawSpriteFrame(ctx, this.ctx.assets, 'zombie-basic', this.animator.frameOf(-3), 0, 0, { alpha: 0.9, flipX: true });
      ctx.restore();
      this.battlefield.drawLighting(ctx, { warm: 0, alert: 0.25, flash: 0 });
    }
  }
}
