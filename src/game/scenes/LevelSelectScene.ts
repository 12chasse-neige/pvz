import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import type { LevelDef } from '../content';
import { LEVELS } from '../content';
import { save } from '../save';
import { Battlefield } from '../render/battlefield';
import { drawSpriteFrame } from '../render/sprites';
import { drawSeedPortrait, drawToolIcon } from '../ui/icons';
import { GameScene } from './GameScene';
import { MenuScene } from './MenuScene';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/**
 * Level select: postcard cards with unique level illustrations, enemy
 * previews, completion state, best result and a locked treatment.
 */
export class LevelSelectScene implements Scene<GameEvents> {
  name = 'levelselect';
  private ctx!: SceneContext<GameEvents>;
  private battlefield!: Battlefield;
  private root!: HTMLDivElement;
  private t = 0;

  constructor(private readonly debugT?: number) {}

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    if (this.debugT !== undefined) this.t = this.debugT;
    this.battlefield = new Battlefield(ctx.assets);
    this.battlefield.refreshFromAssets();
    const data = save.load();

    const root = document.createElement('div');
    root.className = 'menu-screen';
    const title = document.createElement('h1');
    title.className = 'menu-title title-med';
    title.textContent = 'Choose a Garden';

    const grid = document.createElement('div');
    grid.className = 'level-grid';

    LEVELS.forEach((level, i) => {
      const locked = i >= data.unlocked;
      const card = document.createElement('button');
      card.className = 'level-card' + (locked ? ' locked' : '');
      card.setAttribute(
        'aria-label',
        level.name + (locked ? ', locked' : ', play'),
      );

      // painted postcard illustration
      const art = document.createElement('canvas');
      art.width = 136;
      art.height = 96;
      const actx = art.getContext('2d')!;
      this.paintCard(actx, level, i, locked);
      art.className = 'card-art';

      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = locked ? '' : level.name;

      const best = document.createElement('div');
      best.className = 'lv-best';
      const b = data.best[level.id];
      if (locked) {
        const lock = document.createElement('canvas');
        lock.width = 40;
        lock.height = 40;
        const lctx = lock.getContext('2d')!;
        lctx.translate(20, 20);
        drawToolIcon(lctx, ctx.assets, 'lock');
        best.appendChild(lock);
        const hint = document.createElement('div');
        hint.textContent = 'Beat the previous garden';
        best.appendChild(hint);
      } else {
        best.textContent = b ? 'Best: ' + b.kills + ' kills' : 'No score yet';
      }

      card.append(art, name, best);
      card.addEventListener('click', () => {
        if (locked) {
          ctx.audio.seedDenied();
          return;
        }
        ctx.audio.uiClick();
        ctx.sm.replaceFaded(new GameScene(level, randomSeed()), 320);
      });
      grid.appendChild(card);
    });

    const back = document.createElement('button');
    back.className = 'btn secondary';
    back.textContent = 'Back';
    back.setAttribute('aria-label', 'Back to main menu');
    back.addEventListener('click', () => {
      ctx.audio.uiClick();
      ctx.sm.replaceFaded(new MenuScene(), 300);
    });

    root.append(title, grid, back);
    ctx.view.uiInner.appendChild(root);
    this.root = root;
  }

  /** Mini painted preview: lawn + level emblem + enemy silhouettes. */
  private paintCard(ctx: CanvasRenderingContext2D, level: LevelDef, i: number, locked: boolean): void {
    // lawn sketch
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#9fd8ec');
    g.addColorStop(0.55, '#d8ecce');
    g.addColorStop(1, '#63a84c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 136, 96);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 78, 136, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let c = 0; c < 4; c++) ctx.fillRect(14 + c * 30, 8, 18, 10);

    if (locked) {
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      ctx.fillRect(0, 0, 136, 96);
      return;
    }

    // level emblem plant
    const emblem = i === 0 ? 'peashooter' : i === 1 ? 'snowpea' : 'cherrybomb';
    ctx.save();
    ctx.translate(34, 74);
    ctx.scale(0.9, 0.9);
    drawSeedPortrait(ctx, this.ctx.assets, emblem);
    ctx.restore();

    // enemy preview: zombie silhouettes approaching
    const kinds = i === 0 ? ['basic', 'cone'] : i === 1 ? ['cone', 'bucket'] : ['bucket', 'runner'];
    kinds.forEach((kind, k) => {
      if (kind === 'basic') {
        drawSpriteFrame(ctx, this.ctx.assets, 'zombie-basic', 0, 96 + k * 26, 82, { scale: 0.4 });
      } else {
        ctx.fillStyle = 'rgba(60,70,50,0.85)';
        ctx.beginPath();
        ctx.ellipse(100 + k * 26, 66, 9, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(100 + k * 26, 42, 7.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // sun + level number
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(124, 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8a92e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#5c3a1e';
    ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 124, 19.5);
    void level;
  }

  onExit(): void {
    this.root.remove();
  }

  update(dt: number): void {
    if (this.debugT !== undefined) return;
    this.t += dt;
  }

  render(_alpha: number): void {
    const ctx = this.ctx.view.ctx;
    ctx.clearRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
    this.battlefield.drawBack(ctx, this.t, {
      tier: 'high',
      particleScale: 0,
      particleCap: 0,
      shadows: false,
      glow: false,
      ambient: true,
      ambientDensity: 0.4,
      streaks: false,
      dprCap: 2,
      fullRes: true,
    });
    ctx.fillStyle = 'rgba(12,32,18,0.58)';
    ctx.fillRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
  }
}
