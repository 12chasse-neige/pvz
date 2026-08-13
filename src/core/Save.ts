/** Versioned localStorage persistence with safe fallbacks. */
export class Save<T extends object> {
  constructor(
    private readonly key: string,
    private readonly defaults: T,
  ) {}

  load(): T {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return { ...this.defaults };
      return { ...this.defaults, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      return { ...this.defaults };
    }
  }

  write(data: T): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      /* storage unavailable - ignore */
    }
  }
}
