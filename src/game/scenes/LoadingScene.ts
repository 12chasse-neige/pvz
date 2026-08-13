import type { Scene, SceneContext } from '../../core/SceneManager';
import type { GameEvents } from '../events';
import type { LoadProgress } from '../../core/AssetManager';
import { Battlefield } from '../render/battlefield';
import { MenuScene } from './MenuScene';

/**
 * Boot scene: preloads and decodes the manifest + all atlases/textures
 * before the menu can appear. Progress bar + graceful failure/retry
 * screen; gameplay-critical assets are all in this first bundle.
 */
export class LoadingScene implements Scene<GameEvents> {
  name = 'loading';
  private ctx!: SceneContext<GameEvents>;
  private battlefield!: Battlefield;
  private root!: HTMLDivElement;
  private bar!: HTMLDivElement;
  private label!: HTMLDivElement;
  private busy = false;

  constructor(private readonly next?: Scene<GameEvents>) {}

  onEnter(ctx: SceneContext<GameEvents>): void {
    this.ctx = ctx;
    this.battlefield = new Battlefield(ctx.assets);
    const inner = ctx.view.uiInner;

    const root = document.createElement('div');
    root.className = 'loading-screen';
    const title = document.createElement('h1');
    title.className = 'menu-title loading-title';
    title.textContent = 'Garden Defense';
    const sub = document.createElement('div');
    sub.className = 'menu-sub';
    sub.textContent = 'Tending the garden…';
    const track = document.createElement('div');
    track.className = 'load-track';
    this.bar = document.createElement('div');
    this.bar.className = 'load-fill';
    track.appendChild(this.bar);
    this.label = document.createElement('div');
    this.label.className = 'load-label';
    this.label.textContent = 'Loading assets… 0%';
    root.append(title, sub, track, this.label);
    inner.appendChild(root);
    this.root = root;
    void this.run();
  }

  onExit(): void {
    this.root.remove();
  }

  private async run(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const guard = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('timeout')), 20000);
    });
    let result: LoadProgress;
    try {
      result = await Promise.race([this.ctx.assets.preload('assets/manifest.json', (p) => this.setProgress(p)), guard]);
    } catch {
      result = { loaded: 0, total: 1, stage: 'done', failed: ['manifest'] };
    }
    if (result.failed.length > 0) {
      this.showRetry(result.failed);
      this.busy = false;
      return;
    }
    this.battlefield.refreshFromAssets();
    this.setProgress({ loaded: 1, total: 1, stage: 'done', failed: [] });
    this.ctx.sm.replaceFaded(this.next ?? new MenuScene(), 320);
  }

  private setProgress(p: LoadProgress): void {
    const frac = p.total > 0 ? Math.min(1, p.loaded / p.total) : 0;
    this.bar.style.width = (frac * 100).toFixed(1) + '%';
    this.label.textContent = p.stage === 'manifest' ? 'Loading manifest…' : 'Painting sprites… ' + Math.round(frac * 100) + '%';
  }

  private showRetry(failed: string[]): void {
    this.label.textContent = 'Could not load: ' + failed.slice(0, 3).join(', ') + (failed.length > 3 ? '…' : '');
    this.bar.classList.add('failed');
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '↻ Retry';
    btn.setAttribute('aria-label', 'Retry loading game assets');
    btn.addEventListener('click', () => {
      btn.remove();
      this.bar.classList.remove('failed');
      this.setProgress({ loaded: 0, total: 1, stage: 'manifest', failed: [] });
      void this.run();
    });
    this.root.appendChild(btn);
  }

  render(_alpha: number): void {
    const ctx = this.ctx.view.ctx;
    ctx.clearRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
    this.battlefield.drawBack(ctx, 0, { tier: 'high', particleScale: 0, particleCap: 0, shadows: false, glow: false, ambient: true, ambientDensity: 0.3, streaks: false, dprCap: 2, fullRes: true });
    ctx.fillStyle = 'rgba(20,40,25,0.35)';
    ctx.fillRect(0, 0, this.ctx.view.logicalW, this.ctx.view.logicalH);
  }
}
