import type { AssetManager } from './AssetManager';
import type { Audio } from './Audio';
import type { EventBus } from './EventBus';
import type { GameView } from './GameView';
import type { Input } from './Input';
import type { Loop } from './Loop';

export interface SceneContext<E extends object = Record<string, unknown>> {
  view: GameView;
  events: EventBus<E>;
  input: Input;
  assets: AssetManager;
  audio: Audio;
  loop: Loop;
  sm: SceneManager<E>;
}

export interface Scene<E extends object = Record<string, unknown>> {
  name: string;
  onEnter?(ctx: SceneContext<E>, ...args: unknown[]): void;
  onExit?(): void;
  update?(dt: number): void;
  render?(alpha: number): void;
  onResize?(): void;
  onPauseChange?(paused: boolean): void;
}

/** Scene stack: only the top scene updates and renders. */
export class SceneManager<E extends object = Record<string, unknown>> {
  private stack: Scene<E>[] = [];
  readonly ctx: SceneContext<E>;

  constructor(ctx: Omit<SceneContext<E>, 'sm'>) {
    this.ctx = { ...ctx, sm: this };
  }

  current(): Scene<E> | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(scene: Scene<E>, ...args: unknown[]): void {
    this.stack.push(scene);
    scene.onEnter?.(this.ctx, ...args);
  }

  replace(scene: Scene<E>, ...args: unknown[]): void {
    this.pop();
    this.push(scene, ...args);
  }

  pop(): Scene<E> | undefined {
    const s = this.stack.pop();
    s?.onExit?.();
    return s;
  }

  setPaused(paused: boolean): void {
    this.ctx.loop.paused = paused;
    this.current()?.onPauseChange?.(paused);
  }

  update(dt: number): void {
    this.current()?.update?.(dt);
  }

  render(alpha: number): void {
    this.current()?.render?.(alpha);
  }

  onResize(): void {
    this.current()?.onResize?.();
  }
}
