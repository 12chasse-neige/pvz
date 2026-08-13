import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import { LEVELS } from '../content';
import { save } from '../save';
import { createBackground } from '../render/background';
import { drawIcon } from '../render/painters';
import { GameScene } from './GameScene';
import { MenuScene } from './MenuScene';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Level select: one card per level, locked until the previous is beaten. */
export class LevelSelectScene implements Scene<GameEvents> {
  name = 'levelselect';
  private ctx!: SceneContext<GameEvents>;
  private bg!: HTMLCanvasElement;
  private root!: HTMLDivElement;

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.bg = createBackground();
    const data = save.load();

    const root = document.createElement('div');
    root.className = 'menu-screen';
    const title = document.createElement('h1');
    title.style.fontSize = '40px';
    title.style.color = '#ffe14d';
    title.style.textShadow = '3px 3px 0 #2f7a1f, 0 0 20px #000';
    title.textContent = 'Select a Level';

    const grid = document.createElement('div');
    grid.className = 'level-grid';

    LEVELS.forEach((level, i) => {
      const locked = i >= data.unlocked;
      const card = document.createElement('div');
      card.className = 'level-card' + (locked ? ' locked' : '');
      const num = document.createElement('div');
      num.className = 'lv-num';
      num.textContent = locked ? '🔒' : String(i + 1);
      const name = document.createElement('div');
      name.textContent = level.name;
      const icon = document.createElement('canvas');
      icon.width = 56;
      icon.height = 56;
      const ictx = icon.getContext('2d')!;
      ictx.save();
      ictx.translate(28, 30);
      ictx.scale(1.5, 1.5);
      drawIcon(ictx, i === 0 ? 'peashooter' : i === 1 ? 'snowpea' : 'cherrybomb');
      ictx.restore();
      const best = document.createElement('div');
      best.className = 'lv-best';
      const b = data.best[level.id];
      best.textContent = locked ? 'Beat the previous level' : b ? 'Best: ' + b.kills + ' kills' : 'No score yet';
      card.append(num, icon, name, best);
      card.addEventListener('click', () => {
        if (locked) return;
        ctx.sm.replace(new GameScene(level, randomSeed()));
      });
      grid.appendChild(card);
    });

    const back = document.createElement('button');
    back.className = 'btn secondary';
    back.textContent = '← Back';
    back.addEventListener('click', () => ctx.sm.replace(new MenuScene()));

    root.append(title, grid, back);
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
    // dim the board behind the menu
    ctx.fillStyle = 'rgba(10, 30, 15, 0.55)';
    ctx.fillRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
  }
}
