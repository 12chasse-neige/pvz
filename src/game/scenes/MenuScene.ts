import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import { save } from '../save';
import { Battlefield } from '../render/battlefield';
import type { LightingState } from '../render/battlefield';
import { Animator } from '../anim/playback';
import { drawSpriteFrame } from '../render/sprites';
import { paintSunflower, paintWallnut } from '../render/painters';
import { LevelSelectScene } from './LevelSelectScene';
import { GalleryScene } from './GalleryScene';

/**
 * Main menu: painted garden composition, layered title treatment, and an
 * animated plant-vs-zombie vignette across the lawn.
 */
export class MenuScene implements Scene<GameEvents> {
  name = 'menu';
  private ctx!: SceneContext<GameEvents>;
  private battlefield!: Battlefield;
  private root!: HTMLDivElement;
  private animator!: Animator;
  private lighting: LightingState = { warm: 0.35, alert: 0, flash: 0 };
  private t = 0;

  constructor(private readonly debugT?: number) {}

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.battlefield = new Battlefield(ctx.assets);
    this.battlefield.refreshFromAssets();
    this.animator = new Animator((s) => ctx.assets.getSprite(s));
    const uiInner = ctx.view.uiInner;

    const root = document.createElement('div');
    root.className = 'menu-screen';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'menu-title-wrap';
    const kicker = document.createElement('div');
    kicker.className = 'menu-kicker';
    kicker.textContent = 'An original garden defense';
    const title = document.createElement('h1');
    title.className = 'menu-title';
    title.textContent = 'Garden Defense';
    const sub = document.createElement('div');
    sub.className = 'menu-sub';
    sub.textContent = 'Collect sun, plant your defense, and hold the lawn until the last wave.';
    titleWrap.append(kicker, title, sub);

    const play = document.createElement('button');
    play.className = 'btn btn-big menu-play';
    play.textContent = 'Play';
    play.setAttribute('aria-label', 'Play: choose a level');
    play.addEventListener('click', () => {
      ctx.audio.uiClick();
      ctx.sm.replaceFaded(new LevelSelectScene(), 320);
    });

    const how = document.createElement('button');
    how.className = 'btn secondary menu-how';
    how.textContent = 'How to Play';
    how.addEventListener('click', () => {
      ctx.audio.uiClick();
      help.style.display = help.style.display === 'none' ? 'block' : 'none';
    });

    const help = document.createElement('div');
    help.className = 'help-text';
    help.style.display = 'none';
    help.innerHTML =
      '<b>Goal:</b> survive every wave of zombies. A zombie that reaches the house ends the run.<br>' +
      '<b>Sun</b> is your currency: it falls from the sky and is produced by Sunflowers. Click sun to collect it.<br>' +
      '<b>Planting:</b> pick a seed packet (or press 1-5), then click a lawn cell. You can plant during the opening countdown.<br>' +
      '<b>Plants:</b> Sunflower (produces sun) · Peashooter (shoots) · Snow Pea (shoots + slows) · Wall-nut (blocks) · Cherry Bomb (big boom).<br>' +
      '<b>Tools:</b> shovel (S) digs up a plant. Esc pauses. Lawn mowers are a one-time last resort per row.';

    const settingsRow = document.createElement('div');
    settingsRow.className = 'btn-row menu-settings';
    const sound = document.createElement('button');
    sound.className = 'btn secondary';
    const updateSound = (): void => {
      sound.textContent = ctx.audio.getSettings().muted ? 'Sound: Off' : 'Sound: On';
      sound.setAttribute('aria-label', sound.textContent);
    };
    updateSound();
    sound.addEventListener('click', () => {
      ctx.audio.uiClick();
      const data = save.load();
      data.audio.muted = !data.audio.muted;
      save.write(data);
      ctx.audio.setMuted(data.audio.muted);
      updateSound();
    });
    const contrast = document.createElement('button');
    contrast.className = 'btn secondary';
    contrast.textContent = 'High Contrast';
    contrast.addEventListener('click', () => {
      ctx.audio.uiClick();
      const data = save.load();
      data.highContrast = !data.highContrast;
      save.write(data);
      document.body.classList.toggle('high-contrast', data.highContrast);
    });
    const gallery = document.createElement('button');
    gallery.className = 'btn secondary';
    gallery.textContent = 'Art Gallery';
    gallery.setAttribute('aria-label', 'Open the animation gallery');
    gallery.addEventListener('click', () => {
      ctx.audio.uiClick();
      ctx.sm.replaceFaded(new GalleryScene(), 300);
    });
    settingsRow.append(sound, contrast, gallery);

    const actions = document.createElement('div');
    actions.className = 'menu-actions';
    actions.append(play, how);
    root.append(titleWrap, actions, help, settingsRow);
    uiInner.appendChild(root);
    this.root = root;

    ctx.audio.playMusic('menu');
    if (this.debugT !== undefined) {
      this.t = this.debugT;
      this.animator.advance(-1, 'peashooter', 'idle', this.debugT, 1);
      this.animator.advance(-2, 'zombie-basic', 'walk', this.debugT, 1);
      this.animator.advance(-3, 'pea', 'spin', this.debugT, 1);
    }
  }

  onExit(): void {
    this.root.remove();
    this.ctx.audio.stopMusic();
  }

  update(dt: number): void {
    if (this.debugT !== undefined) return;
    this.t += dt;
    this.animator.advance(-1, 'peashooter', 'idle', dt, 1);
    this.animator.advance(-2, 'zombie-basic', 'walk', dt, 1);
    this.animator.advance(-3, 'pea', 'spin', dt, 1);
  }

  render(_alpha: number): void {
    const ctx = this.ctx.view.ctx;
    ctx.clearRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
    this.battlefield.drawBack(ctx, this.t, {
      tier: 'high',
      particleScale: 0,
      particleCap: 0,
      shadows: true,
      glow: true,
      ambient: true,
      ambientDensity: 0.5,
      streaks: false,
      dprCap: 2,
      fullRes: true,
    });
    this.battlefield.drawFront(ctx, this.t);

    // ---- plant-vs-zombie vignette ----
    const t = this.t;
    ctx.save();
    // A staged garden-defense vignette: friendly mass on the left, threat
    // entering from the right, and a projectile connecting the two.
    ctx.translate(116, 472);
    ctx.scale(1.42, 1.42);
    paintSunflower(ctx, t, { glow: 0.25 });
    ctx.restore();
    ctx.save();
    ctx.translate(210, 482);
    ctx.scale(1.08, 1.08);
    paintWallnut(ctx, { hpFrac: 1 });
    ctx.restore();
    // peashooter (baked sprite, idle)
    drawSpriteFrame(ctx, this.ctx.assets, 'peashooter', this.animator.frameOf(-1), 286, 492, { scale: 1.22 });
    // pea flying toward the approaching zombie
    const peaPhase = (t % 1.5) / 1.5;
    drawSpriteFrame(ctx, this.ctx.assets, 'pea', this.animator.frameOf(-3), 332 + peaPhase * 260, 448 - Math.sin(peaPhase * Math.PI) * 13, { scale: 1.08 });
    // zombie ambles across the menu (flipped to face the plants)
    const zx = 735 - ((t * 22) % 900);
    drawSpriteFrame(ctx, this.ctx.assets, 'zombie-basic', this.animator.frameOf(-2), zx, 516, {
      scale: 0.92,
      flipX: true,
    });
    ctx.restore();

    // Shape the contrast around the title while preserving the painted lawn.
    const shade = ctx.createRadialGradient(400, 210, 80, 400, 250, 500);
    shade.addColorStop(0, 'rgba(12,34,18,0.10)');
    shade.addColorStop(0.58, 'rgba(12,34,18,0.22)');
    shade.addColorStop(1, 'rgba(8,20,12,0.46)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
    const ground = ctx.createLinearGradient(0, 360, 0, 600);
    ground.addColorStop(0, 'rgba(5,18,9,0)');
    ground.addColorStop(1, 'rgba(5,18,9,0.22)');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 360, 800, 240);
    this.battlefield.drawLighting(ctx, this.lighting);
  }
}
