/** Pausable one-shot timers ticked from a scene update. */
export class Timers {
  private list: { t: number; fn: () => void }[] = [];

  update(dt: number): void {
    if (this.list.length === 0) return;
    for (const t of this.list) t.t -= dt;
    const due = this.list.filter((t) => t.t <= 0);
    this.list = this.list.filter((t) => t.t > 0);
    for (const t of due) t.fn();
  }

  after(sec: number, fn: () => void): void {
    this.list.push({ t: sec, fn });
  }

  clear(): void {
    this.list = [];
  }
}
