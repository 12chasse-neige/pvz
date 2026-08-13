import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import type { LevelStats } from '../events';
import type { LevelDef } from '../content';
import { LEVELS } from '../content';
import { recordResult } from '../save';
import { createBackground } from '../render/background';
import { GameScene } from './GameScene';
import { LevelSelectScene } from './LevelSelectScene';
import { MenuScene } from './MenuScene';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Victory / defeat screen with stats and progression persistence. */
export class ResultScene implements Scene<GameEvents> {
  name = 'result';
  private ctx!: SceneContext<GameEvents>;
  private bg!: HTMLCanvasElement;
  private root!: HTMLDivElement;

  constructor(
    private readonly level: LevelDef,
    private readonly won: boolean,
    private readonly stats: LevelStats,
  ) {}

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.bg = createBackground();
    const levelIndex = LEVELS.indexOf(this.level);
    if (this.won) recordResult(levelIndex, this.stats.kills, this.stats.time);
    const hasNext = this.won && levelIndex + 1 < LEVELS.length;

    const root = document.createElement('div');
    root.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';

    const title = document.createElement('h1');
    title.textContent = this.won ? 'VICTORY!' : 'THE ZOMBIES ATE YOUR BRAINS!';
    const statsEl = document.createElement('div');
    statsEl.className = 'stats';
    const mm = Math.floor(this.stats.time / 60);
    const ss = String(this.stats.time % 60).padStart(2, '0');
    statsEl.innerHTML =
      'Zombies defeated: <b>' + this.stats.kills + '</b><br>' +
      'Sun collected: <b>' + this.stats.sun + '</b><br>' +
      'Time: <b>' + mm + ':' + ss + '</b>';

    const row = document.createElement('div');
    row.className = 'btn-row';
    if (hasNext) {
      const next = document.createElement('button');
      next.className = 'btn';
      next.textContent = 'Next Level →';
      next.addEventListener('click', () => {
        ctx.sm.replace(new GameScene(LEVELS[levelIndex + 1]!, randomSeed()));
      });
      row.appendChild(next);
    }
    const retry = document.createElement('button');
    retry.className = 'btn' + (hasNext ? ' secondary' : '');
    retry.textContent = '↻ Retry';
    retry.addEventListener('click', () => {
      ctx.sm.replace(new GameScene(this.level, randomSeed()));
    });
    const select = document.createElement('button');
    select.className = 'btn secondary';
    select.textContent = 'Level Select';
    select.addEventListener('click', () => ctx.sm.replace(new LevelSelectScene()));
    const menu = document.createElement('button');
    menu.className = 'btn secondary';
    menu.textContent = 'Main Menu';
    menu.addEventListener('click', () => ctx.sm.replace(new MenuScene()));
    row.append(retry, select, menu);

    panel.append(title, statsEl, row);
    root.appendChild(panel);
    ctx.view.uiInner.appendChild(root);
    this.root = root;
  }

  onExit(): void {
    this.root.remove();
  }

  render(_alpha: number): void {
    const ctx = this.ctx.view.ctx;
    ctx.clearRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
    ctx.drawImage(this.bg, 0, 0);
    ctx.fillStyle = 'rgba(8, 20, 12, 0.6)';
    ctx.fillRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
  }
}
