export type Entity = number;
export type System = (world: World, dt: number) => void;

/**
 * Lightweight entity-component system.
 *
 * - Entities are plain integer ids.
 * - Components live in per-name maps (entity counts are tiny in this game).
 * - destroy() is deferred until flushDestroyed(), so systems can safely
 *   destroy entities while iterating query results.
 * - Systems are ordered functions registered with addSystem(); update(dt)
 *   runs each in order and flushes destructions after every system, so
 *   later systems never observe dead entities.
 * - Shared mutable state lives in resources (e.g. the seeded Rng,
 *   sun bank, wave schedule, grid occupancy).
 *
 * Convention: systems must guard entity references with world.alive(e).
 */
export class World {
  private nextId: Entity = 1;
  private freeIds: Entity[] = [];
  private byName = new Map<string, Map<Entity, unknown>>();
  private maskOf = new Map<Entity, Set<string>>();
  private destroyQueue: Entity[] = [];
  readonly resources: Record<string, unknown> = {};
  private systems: { name: string; fn: System }[] = [];

  spawn(): Entity {
    const e = this.freeIds.length > 0 ? this.freeIds.pop()! : this.nextId++;
    this.maskOf.set(e, new Set());
    return e;
  }

  alive(e: Entity): boolean {
    return this.maskOf.has(e);
  }

  addComponent<T>(e: Entity, name: string, value: T): T {
    const mask = this.maskOf.get(e);
    if (!mask) throw new Error('addComponent on dead entity ' + e);
    let map = this.byName.get(name);
    if (!map) {
      map = new Map();
      this.byName.set(name, map);
    }
    map.set(e, value);
    mask.add(name);
    return value;
  }

  has(e: Entity, name: string): boolean {
    const mask = this.maskOf.get(e);
    return !!mask && mask.has(name);
  }

  get<T>(e: Entity, name: string): T | undefined {
    const map = this.byName.get(name);
    return map?.get(e) as T | undefined;
  }

  removeComponent(e: Entity, name: string): void {
    this.byName.get(name)?.delete(e);
    this.maskOf.get(e)?.delete(name);
  }

  /** All entities carrying every named component. */
  query(...names: string[]): Entity[] {
    if (names.length === 0) return [...this.maskOf.keys()];
    let smallest: Map<Entity, unknown> | null = null;
    for (const n of names) {
      const map = this.byName.get(n);
      if (!map || map.size === 0) return [];
      if (!smallest || map.size < smallest.size) smallest = map;
    }
    const result: Entity[] = [];
    for (const e of smallest!.keys()) {
      const mask = this.maskOf.get(e);
      if (mask && names.every((n) => mask.has(n))) result.push(e);
    }
    return result;
  }

  destroy(e: Entity): void {
    if (this.maskOf.has(e) && !this.destroyQueue.includes(e)) {
      this.destroyQueue.push(e);
    }
  }

  flushDestroyed(): void {
    for (const e of this.destroyQueue) {
      const mask = this.maskOf.get(e);
      if (!mask) continue;
      for (const name of mask) this.byName.get(name)?.delete(e);
      this.maskOf.delete(e);
      this.freeIds.push(e);
    }
    this.destroyQueue.length = 0;
  }

  addSystem(name: string, fn: System): void {
    this.systems.push({ name, fn });
  }

  update(dt: number): void {
    for (const s of this.systems) s.fn(this, dt);
    this.flushDestroyed();
  }

  entityCount(): number {
    return this.maskOf.size;
  }
}
