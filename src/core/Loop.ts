/**
 * Fixed-timestep game loop.
 * - requestAnimationFrame driver.
 * - Fixed 1/60 s update steps with an accumulator; render receives an
 *   interpolation alpha (unused for now - render reads latest state).
 * - Frame time is clamped (0.25 s) and reset on tab-hide to avoid the
 *   spiral of death after the tab regains focus.
 * - While paused, no updates run; a single render per frame keeps the
 *   screen responsive.
 */
export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  paused = false;
  readonly dt = 1 / 60;
  private readonly maxFrame = 0.25;
  /** Optional per-frame hook, run every rAF tick even while paused. */
  onFrame: (() => void) | null = null;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    this.onFrame?.();

    let frame = (now - this.last) / 1000;
    this.last = now;
    if (document.hidden || frame > this.maxFrame) {
      frame = 0;
      this.acc = 0;
    }

    if (this.paused) {
      this.render(1);
      return;
    }

    this.acc += frame;
    let steps = 0;
    while (this.acc >= this.dt && steps < 10) {
      this.update(this.dt);
      this.acc -= this.dt;
      steps++;
    }
    if (steps >= 10) this.acc = 0;
    this.render(Math.min(Math.max(this.acc / this.dt, 0), 1));
  };
}
