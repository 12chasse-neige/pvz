import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import type { AssetManager } from '../../core/AssetManager';
import type { SpriteAtlasDef } from '../anim/types';
import { Animator } from '../anim/playback';
import { drawSpriteFrame } from '../render/sprites';
import { drawSeedPacket } from '../../art/ui';
import { drawSeedPortrait } from '../ui/icons';
import { MenuScene } from './MenuScene';

interface Cell {
  sprite: string;
  clip: string;
  id: number;
  label: string;
  draw?: (ctx: CanvasRenderingContext2D, assets: AssetManager) => void;
}

interface Group {
  name: string;
  cells: Cell[];
}

/**
 * In-project animation gallery: every plant, zombie, projectile, mower,
 * effect and HUD state, animated against alternating light and dark
 * backgrounds. Used for art review before assets ship.
 */
export class GalleryScene implements Scene<GameEvents> {
  name = 'gallery';
  private ctx!: SceneContext<GameEvents>;
  private root!: HTMLDivElement;
  private animator!: Animator;
  private groups: Group[] = [];
  private groupIndex = 0;
  private nextId = -1;
  private tabBar!: HTMLDivElement;

  constructor(
    private readonly debugGroup?: number,
    private readonly debugT?: number,
  ) {}

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    if (this.debugGroup !== undefined) this.groupIndex = this.debugGroup;
    this.animator = new Animator((s) => ctx.assets.getSprite(s));
    this.buildGroups();

    const root = document.createElement('div');
    root.className = 'gallery-screen';
    const title = document.createElement('h1');
    title.className = 'menu-title title-med';
    title.textContent = 'Animation Gallery';
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'btn-row';
    const back = document.createElement('button');
    back.className = 'btn secondary';
    back.textContent = 'Back';
    back.setAttribute('aria-label', 'Back to main menu');
    back.addEventListener('click', () => ctx.sm.replaceFaded(new MenuScene(), 300));
    root.append(title, this.tabBar, back);
    ctx.view.uiInner.appendChild(root);
    this.root = root;
    this.renderTabs();
  }

  private cell(sprite: string, clip: string, label: string): Cell {
    return { sprite, clip, id: this.nextId--, label };
  }

  private buildGroups(): void {
    const def = (key: string): SpriteAtlasDef | undefined => this.ctx.assets.getSprite(key);
    const has = (key: string, clip: string): boolean => !!def(key)?.clips[clip];
    const plants: Cell[] = [];
    for (const [sprite, clips] of [
      ['peashooter', ['idle', 'fire', 'hit']],
      ['snowpea', ['idle', 'fire', 'hit']],
      ['sunflower', ['idle', 'produce']],
      ['wallnut', ['full', 'cracked', 'broken', 'squash']],
      ['cherry', ['idle', 'urgent', 'preflash']],
    ] as const) {
      for (const clip of clips) {
        if (has(sprite, clip)) plants.push(this.cell(sprite, clip, sprite.replace('snowpea', 'snow pea').replace('wallnut', 'wall-nut') + ' · ' + clip));
      }
    }
    const zombies: Cell[] = [];
    for (const [sprite, extra] of [
      ['zombie-basic', []] as [string, string[]],
      ['zombie-cone', ['walk-dmg1', 'walk-dmg2', 'eat-dmg1', 'eat-dmg2']],
      ['zombie-bucket', ['walk-dmg1', 'walk-dmg2', 'eat-dmg1', 'eat-dmg2']],
      ['zombie-runner', []],
      ['zombie-flag', []],
    ] as [string, string[]][]) {
      const clips = ['walk', 'eat', 'death', ...extra];
      for (const clip of clips) {
        if (has(sprite, clip)) zombies.push(this.cell(sprite, clip, sprite.replace('zombie-', '') + ' · ' + clip));
      }
    }
    const effects: Cell[] = [];
    for (const [sprite, clips] of [
      ['pea', ['spin']],
      ['pea-frozen', ['spin']],
      ['sun', ['pulse']],
      ['mower', ['idle', 'run']],
      ['blast', ['boom']],
    ] as const) {
      for (const clip of clips) {
        if (has(sprite, clip)) effects.push(this.cell(sprite, clip, sprite + ' · ' + clip));
      }
    }
    effects.push({
      sprite: '',
      clip: '',
      id: this.nextId--,
      label: 'particles · sample',
      draw: (c) => {
        const dots: [number, number, number, string][] = [
          [0, 0, 7, '#a8e860'],
          [18, -10, 5, '#ffe14d'],
          [-14, 8, 6, '#9fd8ff'],
          [10, 14, 4, '#ffb14d'],
          [-6, -16, 5, 'rgba(200,200,196,0.7)'],
        ];
        for (const [x, y, r, color] of dots) {
          c.fillStyle = color;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
        }
      },
    });
    const ui: Cell[] = [];
    for (const key of ['sun', 'shovel', 'pause', 'sound-on', 'sound-off', 'flag', 'lock', 'zombie', 'unknown'] as const) {
      if (has('ui.' + key, 'static')) ui.push(this.cell('ui.' + key, 'static', key));
    }
    ui.push({
      sprite: '',
      clip: '',
      id: this.nextId--,
      label: 'seed packet · ready',
      draw: (c, assets) => {
        c.save();
        c.translate(0, 2);
        c.scale(0.9, 0.9);
        drawSeedPacket(c, (p) => drawSeedPortrait(p, assets, 'peashooter'), 100, '1', true);
        c.restore();
      },
    });
    ui.push({
      sprite: '',
      clip: '',
      id: this.nextId--,
      label: 'seed packet · cooling',
      draw: (c, assets) => {
        c.save();
        c.translate(0, 2);
        c.scale(0.9, 0.9);
        drawSeedPacket(c, (p) => drawSeedPortrait(p, assets, 'wallnut'), 50, '3', false);
        c.fillStyle = 'rgba(20,16,40,0.55)';
        c.fillRect(-28, -30, 56, 22);
        c.fillStyle = '#ffffff';
        c.font = 'bold 12px "Trebuchet MS", sans-serif';
        c.textAlign = 'center';
        c.fillText('2', 0, -14);
        c.restore();
      },
    });
    this.groups = [
      { name: 'Plants', cells: plants },
      { name: 'Zombies', cells: zombies },
      { name: 'Effects', cells: effects },
      { name: 'UI', cells: ui },
    ];
  }

  private renderTabs(): void {
    this.tabBar.textContent = '';
    this.groups.forEach((g, i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === this.groupIndex ? '' : ' secondary');
      b.textContent = g.name + ' (' + g.cells.length + ')';
      b.setAttribute('aria-pressed', String(i === this.groupIndex));
      b.addEventListener('click', () => {
        this.groupIndex = i;
        this.renderTabs();
      });
      this.tabBar.appendChild(b);
    });
  }

  onExit(): void {
    this.root.remove();
  }

  update(dt: number): void {
    if (this.debugT !== undefined) return;
    for (const group of this.groups) {
      for (const cell of group.cells) {
        if (cell.sprite) this.animator.advance(cell.id, cell.sprite, cell.clip, dt, 1);
      }
    }
  }

  render(_alpha: number): void {
    const ctx = this.ctx.view.ctx;
    ctx.clearRect(0, 0, 800, 600);
    ctx.fillStyle = '#141a14';
    ctx.fillRect(0, 0, 800, 600);

    const group = this.groups[this.groupIndex]!;
    const margin = 14;
    const gap = 8;
    const top = 116;
    const cols = Math.ceil(Math.sqrt(group.cells.length));
    const rows = Math.ceil(group.cells.length / cols);
    const cellW = (800 - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = (600 - top - margin - gap * (rows - 1)) / rows;

    group.cells.forEach((cell, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cellW + gap);
      const y = top + row * (cellH + gap);
      const dark = (col + row) % 2 === 0;
      // background
      ctx.fillStyle = dark ? '#262c26' : '#e8dfc8';
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = dark ? '#4a544a' : '#b8ab90';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, cellW, cellH);
      // label
      ctx.fillStyle = dark ? '#e8f0d8' : '#3c3a2c';
      ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cell.label, x + cellW / 2, y + 12);

      if (cell.draw) {
        ctx.save();
        ctx.translate(x + cellW / 2, y + cellH / 2 + 8);
        cell.draw(ctx, this.ctx.assets);
        ctx.restore();
        return;
      }
      const def = this.ctx.assets.getSprite(cell.sprite);
      if (!def) return;
      const fit = Math.min((cellW - 18) / def.logicalW, (cellH - 26) / def.logicalH, 1.25);
      const bottomAnchor = def.pivot[1] > 0.85;
      const cx = x + cellW / 2;
      const cy = bottomAnchor ? y + cellH - 10 : y + cellH / 2 + 6;
      drawSpriteFrame(ctx, this.ctx.assets, cell.sprite, this.animator.frameOf(cell.id), cx, cy, {
        scale: fit,
      });
    });
  }
}
