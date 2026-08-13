import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { Rng } from '../src/core/Rng';
import { Save } from '../src/core/Save';
import { World } from '../src/core/ecs/World';
import { approach, clamp, dist2, lerp, rectsOverlap } from '../src/core/math';

describe('math', () => {
  it('clamp bounds values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('approach steps toward a target without overshoot', () => {
    expect(approach(5, 10, 3)).toBe(8);
    expect(approach(5, 0, 3)).toBe(2);
    expect(approach(5, 6, 3)).toBe(6);
  });

  it('dist2 is squared euclidean distance', () => {
    expect(dist2(0, 0, 3, 4)).toBe(25);
  });

  it('rectsOverlap detects overlap and separation', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 })).toBe(false);
  });
});

describe('Rng', () => {
  it('is deterministic for a fixed seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = [a.next(), a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('values are within [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int stays within the inclusive range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 300; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('pickWeighted ignores zero-weight items', () => {
    const r = new Rng(3);
    const pick = () => r.pickWeighted(['a', 'b'] as const, (s) => (s === 'a' ? 0 : 1));
    for (let i = 0; i < 20; i++) expect(pick()).toBe('b');
  });
});

describe('World (ECS)', () => {
  it('adds, gets and removes components', () => {
    const w = new World();
    const e = w.spawn();
    w.addComponent(e, 'Position', { x: 3, y: 4 });
    expect(w.has(e, 'Position')).toBe(true);
    expect(w.get<{ x: number; y: number }>(e, 'Position')).toEqual({ x: 3, y: 4 });
    w.removeComponent(e, 'Position');
    expect(w.has(e, 'Position')).toBe(false);
    expect(w.get(e, 'Position')).toBeUndefined();
  });

  it('queries entities carrying all requested components', () => {
    const w = new World();
    const a = w.spawn();
    const b = w.spawn();
    const c = w.spawn();
    w.addComponent(a, 'Position', { x: 0, y: 0 });
    w.addComponent(a, 'Health', { hp: 10 });
    w.addComponent(b, 'Position', { x: 1, y: 1 });
    w.addComponent(c, 'Health', { hp: 5 });
    expect(w.query('Position').sort()).toEqual([a, b]);
    expect(w.query('Health').sort()).toEqual([a, c]);
    expect(w.query('Position', 'Health')).toEqual([a]);
  });

  it('defers destruction until flush and recycles ids', () => {
    const w = new World();
    const e = w.spawn();
    w.addComponent(e, 'Position', { x: 0, y: 0 });
    w.destroy(e);
    // still alive until flush
    expect(w.alive(e)).toBe(true);
    w.flushDestroyed();
    expect(w.alive(e)).toBe(false);
    expect(w.get(e, 'Position')).toBeUndefined();
    const e2 = w.spawn();
    expect(e2).toBe(e); // id recycled
  });

  it('runs systems in registration order and flushes between them', () => {
    const w = new World();
    const order: string[] = [];
    w.addSystem('first', (world, dt) => {
      order.push('first:' + dt);
      world.destroy(world.spawn());
    });
    w.addSystem('second', () => order.push('second'));
    w.update(0.5);
    expect(order).toEqual(['first:0.5', 'second']);
    expect(w.entityCount()).toBe(0);
  });

  it('throws when adding a component to a dead entity', () => {
    const w = new World();
    const e = w.spawn();
    w.destroy(e);
    w.flushDestroyed();
    expect(() => w.addComponent(e, 'Position', { x: 0, y: 0 })).toThrow();
  });
});

describe('EventBus', () => {
  it('delivers payloads to subscribers and supports unsubscribe', () => {
    const bus = new EventBus<{ ping: number }>();
    const seen: number[] = [];
    const off = bus.on('ping', (n) => seen.push(n));
    bus.emit('ping', 1);
    bus.emit('ping', 2);
    off();
    bus.emit('ping', 3);
    expect(seen).toEqual([1, 2]);
  });

  it('emitting with no subscribers is a no-op', () => {
    const bus = new EventBus<{ ping: number }>();
    expect(() => bus.emit('ping', 1)).not.toThrow();
  });
});

describe('Save', () => {
  const store = new Map<string, string>();

  function stubLocalStorage(): void {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  }

  it('returns defaults when nothing is stored', () => {
    store.clear();
    stubLocalStorage();
    const save = new Save<{ best: number }>('test-key', { best: 0 });
    expect(save.load()).toEqual({ best: 0 });
  });

  it('round-trips data and merges with defaults', () => {
    store.clear();
    stubLocalStorage();
    const save = new Save<{ best: number; unlocked: number }>('test-key', { best: 0, unlocked: 1 });
    save.write({ best: 900, unlocked: 2 });
    expect(save.load()).toEqual({ best: 900, unlocked: 2 });
  });

  it('recovers from corrupt JSON', () => {
    store.clear();
    stubLocalStorage();
    store.set('test-key', '{not json');
    const save = new Save<{ best: number }>('test-key', { best: 0 });
    expect(save.load()).toEqual({ best: 0 });
  });
});
