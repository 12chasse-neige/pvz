type Handler<T> = (payload: T) => void;

/**
 * Synchronous typed event bus. Game code emits domain events
 * (sun collected, zombie killed, ...) and UI/audio/effects subscribe.
 */
export class EventBus<E extends object = Record<string, unknown>> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  /** Subscribe; returns an unsubscribe function. */
  on<K extends keyof E>(event: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Iterate a copy so handlers may unsubscribe mid-emit.
    for (const fn of [...set]) (fn as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
