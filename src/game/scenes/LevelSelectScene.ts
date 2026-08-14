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
    // Each postcard is its own tiny landscape: morning, clear afternoon,
    // and a dramatic late-day garden. Shared framing keeps the set cohesive.
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    const skies = [
      ['#8fd1ed', '#eaf3cf'],
      ['#6cbce8', '#d8edc4'],
      ['#7c91c8', '#f2bd78'],
    ] as const;
    g.addColorStop(0, skies[i]?.[0] ?? skies[0][0]);
    g.addColorStop(0.6, skies[i]?.[1] ?? skies[0][1]);
    g.addColorStop(1, i === 2 ? '#517b3d' : '#63a84c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 136, 96);

    // sun/moon glow
    const sunX = i === 2 ? 109 : 116;
    const sunY = i === 2 ? 24 : 18;
    const glow = ctx.createRadialGradient(sunX, sunY, 1, sunX, sunY, 20);
    glow.addColorStop(0, i === 2 ? 'rgba(255,223,160,0.9)' : 'rgba(255,245,190,0.9)');
    glow.addColorStop(1, 'rgba(255,245,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 22, sunY - 22, 44, 44);

    // soft clouds and distant hedge
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    for (const [cx, cy, s] of [[22, 18, 1], [72, 29, 0.65]] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, 7 * s, 0, Math.PI * 2);
      ctx.arc(cx + 8 * s, cy + 2, 6 * s, 0, Math.PI * 2);
      ctx.arc(cx - 7 * s, cy + 3, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = i === 2 ? '#3e6538' : '#5a9345';
    ctx.beginPath();
    ctx.moveTo(0, 66);
    for (let x = 0; x <= 136; x += 12) ctx.quadraticCurveTo(x + 6, 53 + ((x / 12) % 2) * 5, x + 12, 64);
    ctx.lineTo(136, 96);
    ctx.lineTo(0, 96);
    ctx.closePath();
    ctx.fill();
    const lawn = ctx.createLinearGradient(0, 63, 0, 96);
    lawn.addColorStop(0, i === 2 ? '#668c48' : '#79b85a');
    lawn.addColorStop(1, i === 2 ? '#456d35' : '#4f8d3e');
    ctx.fillStyle = lawn;
    ctx.beginPath();
    ctx.moveTo(0, 66);
    ctx.quadraticCurveTo(68, 58, 136, 68);
    ctx.lineTo(136, 96);
    ctx.lineTo(0, 96);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(233,255,192,0.20)';
    ctx.lineWidth = 1.3;
    for (let y = 75; y < 96; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(68, y - 5, 136, y + 1);
      ctx.stroke();
    }

    if (locked) {
      ctx.fillStyle = 'rgba(30,34,34,0.62)';
      ctx.fillRect(0, 0, 136, 96);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 94);
      ctx.lineTo(136, 2);
      ctx.stroke();
      return;
    }

    // level emblem plant
    const emblem = i === 0 ? 'peashooter' : i === 1 ? 'snowpea' : 'cherrybomb';
    ctx.save();
    ctx.translate(34, 84);
    ctx.scale(0.88, 0.88);
    drawSeedPortrait(ctx, this.ctx.assets, emblem);
    ctx.restore();

    // enemy preview: zombie silhouettes approaching
    const kinds = i === 0 ? ['basic', 'cone'] : i === 1 ? ['cone', 'bucket'] : ['bucket', 'runner'];
    kinds.forEach((kind, k) => {
      const sprite = kind === 'basic' ? 'zombie-basic' : kind === 'cone' ? 'zombie-cone' : kind === 'bucket' ? 'zombie-bucket' : 'zombie-runner';
      drawSpriteFrame(ctx, this.ctx.assets, sprite, 0, 102 + k * 23, 91, { scale: 0.36, flipX: true });
    });
    // stamped level number
    ctx.fillStyle = 'rgba(246,227,181,0.92)';
    ctx.beginPath();
    ctx.arc(123, 15, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(92,58,30,0.65)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = '#5c3a1e';
    ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 123, 18.5);
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
