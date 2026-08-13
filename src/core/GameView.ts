import { clamp } from './math';

/**
 * Canvas + letterboxing. The game always renders in a fixed logical
 * 800x600 space; the canvas backing store is scaled to the window with
 * devicePixelRatio and the ctx transform maps game pixels to device
 * pixels. screenToGame converts client coordinates back into game space
 * for input handling.
 */
export class GameView {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly stage: HTMLElement;
  readonly ui: HTMLElement;
  readonly uiInner: HTMLElement;
  readonly logicalW = 800;
  readonly logicalH = 600;
  scale = 1;
  /** Cap on device pixel ratio (adaptive quality lowers it on tablets). */
  dprCap = 2;

  constructor(stage: HTMLElement, canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.stage = stage;
    this.canvas = canvas;
    this.ui = ui;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    const inner = document.createElement('div');
    inner.id = 'ui-inner';
    ui.appendChild(inner);
    this.uiInner = inner;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.scale = clamp(Math.min(w / this.logicalW, h / this.logicalH), 0.2, 4);
    const cssW = Math.round(this.logicalW * this.scale);
    const cssH = Math.round(this.logicalH * this.scale);
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.stage.style.width = cssW + 'px';
    this.stage.style.height = cssH + 'px';
    // Map game coordinates -> device pixels.
    this.ctx.setTransform(
      this.canvas.width / this.logicalW,
      0,
      0,
      this.canvas.height / this.logicalH,
      0,
      0,
    );
    // Keep the DOM overlay in the same game-pixel coordinate system.
    this.uiInner.style.transform = 'scale(' + this.scale + ')';
  }

  screenToGame(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * this.logicalW) / rect.width,
      y: ((clientY - rect.top) * this.logicalH) / rect.height,
    };
  }
}
