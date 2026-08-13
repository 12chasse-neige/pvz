export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  moved: boolean;
}

/**
 * Minimal input layer: pointer position (client coords; scenes convert to
 * game space via GameView.screenToGame) and keyboard state.
 * justPressed is an edge-triggered key set cleared each frame via
 * endFrame() (called by the loop every frame, even while paused).
 */
export class Input {
  pointer: PointerState = { x: 0, y: 0, down: false, moved: false };
  keys = new Set<string>();
  justPressed = new Set<string>();

  onDown: ((e: PointerEvent) => void) | null = null;
  onUp: ((e: PointerEvent) => void) | null = null;
  onMove: ((e: PointerEvent) => void) | null = null;

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointerdown', this.handleDown);
    window.addEventListener('pointerup', this.handleUp);
    window.addEventListener('pointermove', this.handleMove);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.handleDown);
    window.removeEventListener('pointerup', this.handleUp);
    window.removeEventListener('pointermove', this.handleMove);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  endFrame(): void {
    this.justPressed.clear();
  }

  private handleDown = (e: PointerEvent): void => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.down = true;
    this.pointer.moved = false;
    this.onDown?.(e);
  };

  private handleUp = (e: PointerEvent): void => {
    this.pointer.down = false;
    this.onUp?.(e);
  };

  private handleMove = (e: PointerEvent): void => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.moved = true;
    this.onMove?.(e);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
    if (!this.keys.has(k)) this.justPressed.add(k);
    this.keys.add(k);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.pointer.down = false;
  };
}
