import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import { save } from '../save';
import { createBackground } from '../render/background';
import { paintPeashooter, paintSunEntity, paintSunflower, paintWallnut, paintZombie } from '../render/painters';
import { LevelSelectScene } from './LevelSelectScene';

/** Main menu: title screen with a few decorative animated entities. */
export class MenuScene implements Scene<GameEvents> {
  name = 'menu';
  private ctx!: SceneContext<GameEvents>;
  private bg!: HTMLCanvasElement;
  private root!: HTMLDivElement;
  private t = 0;

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.bg = createBackground();
    const uiInner = ctx.view.uiInner;

    const root = document.createElement('div');
    root.className = 'menu-screen';

    const title = document.createElement('h1');
    title.className = 'menu-title';
    title.textContent = 'PLANTS vs ZOMBIES';
    const sub = document.createElement('div');
    sub.className = 'menu-sub';
    sub.textContent = 'Defend your lawn! Collect sun, plant your defense, survive the waves.';

    const play = document.createElement('button');
    play.className = 'btn';
    play.textContent = '▶ Play';
    play.addEventListener('click', () => ctx.sm.replace(new LevelSelectScene()));

    const how = document.createElement('button');
    how.className = 'btn secondary';
    how.textContent = 'How to Play';

    const help = document.createElement('div');
    help.className = 'help-text';
    help.style.display = 'none';
    help.innerHTML =
      '<b>Goal:</b> survive every wave of zombies. A zombie that reaches the house ends the run.<br>' +
      '<b>Sun</b> is your currency: it falls from the sky and is produced by Sunflowers. Click sun to collect it.<br>' +
      '<b>Planting:</b> pick a seed card (or press 1-5), then click a lawn cell. You can plant during the opening countdown.<br>' +
      '<b>Plants:</b> Sunflower (produces sun) · Peashooter (shoots) · Snow Pea (shoots + slows) · Wall-nut (blocks) · Cherry Bomb (big boom).<br>' +
      '<b>Tools:</b> shovel (S) digs up a plant. Esc pauses. Lawn mowers are a one-time last resort per row.';

    how.addEventListener('click', () => {
      help.style.display = help.style.display === 'none' ? 'block' : 'none';
    });

    const mute = document.createElement('button');
    mute.className = 'btn secondary';
    const updateMute = (): void => {
      mute.textContent = ctx.audio.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
    };
    updateMute();
    mute.addEventListener('click', () => {
      const data = save.load();
      data.muted = !data.muted;
      save.write(data);
      ctx.audio.setMuted(data.muted);
      updateMute();
    });

    root.append(title, sub, play, how, mute, help);
    uiInner.appendChild(root);
    this.root = root;
  }

  onExit(): void {
    this.root.remove();
  }

  update(dt: number): void {
    this.t += dt;
  }

  render(_alpha: number): void {
    const ctx = this.ctx.view.ctx;
    ctx.clearRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
    ctx.drawImage(this.bg, 0, 0);
    const t = this.t;
    ctx.save();
    ctx.translate(130, 440);
    ctx.scale(1.5, 1.5);
    paintSunflower(ctx, t, { glow: 0.3 });
    ctx.restore();
    ctx.save();
    ctx.translate(215, 452);
    ctx.scale(1.4, 1.4);
    paintPeashooter(ctx, t, { frozen: false, recoil: 0 });
    ctx.restore();
    ctx.save();
    ctx.translate(300, 455);
    paintWallnut(ctx, { hpFrac: 1 });
    ctx.restore();
    ctx.save();
    ctx.translate(660, 170);
    ctx.scale(1.6, 1.6);
    paintSunEntity(ctx, t);
    ctx.restore();
    // A zombie ambles across the menu.
    const zx = 900 - ((t * 34) % 1100);
    ctx.save();
    ctx.translate(zx, 500);
    ctx.scale(1.6, 1.6);
    paintZombie(ctx, t, { eating: false, slowed: false, flash: 0, accessory: 'cone' });
    ctx.restore();
  }
}
