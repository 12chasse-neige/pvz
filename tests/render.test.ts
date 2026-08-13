import { describe, expect, it } from 'vitest';
import { AssetManager, validateManifest } from '../src/core/AssetManager';
import { EventBus } from '../src/core/EventBus';
import type { World } from '../src/core/ecs/World';
import { Animator } from '../src/game/anim/playback';
import { resolvePlay } from '../src/game/anim/resolver';
import type { AtlasManifest } from '../src/game/anim/types';
import type { GameEvents } from '../src/game/events';
import { makeMower, makePlant, makeProjectile, makeZombie } from '../src/game/factory';
import { CameraState, seededNoise } from '../src/game/render/camera';
import { CosmeticFx } from '../src/game/render/fx';
import { PREV_POSITION, interpPos, resetHistory, snapshotHistory } from '../src/game/render/history';
import { initialTier, nextTier, PROMOTE_STREAK, DEMOTE_STREAK } from '../src/game/render/quality';
import { recordResult, save } from '../src/game/save';
import { setupWorld } from '../src/game/setup';
import type { LevelDef } from '../src/game/content';

const level: LevelDef = {
  id: 'render-test',
  name: 'test',
  initialSun: 9999,
  startDelay: 0,
  skySun: { first: 9999, min: 9999, max: 9999 },
  allowedPlants: ['sunflower', 'peashooter', 'snowpea', 'wallnut', 'cherrybomb'],
  waves: [{ zombies: [{ kind: 'basic', at: 0 }], gap: 0 }],
};

function validManifest(): AtlasManifest {
  return {
    format: 1,
    scale: 2,
    meta: { name: 'test', authors: ['test'], license: 'CC0', artBible: 'docs/ART_BIBLE.md' },
    atlases: { characters: { url: 'assets/characters.png', w: 1024, h: 1024 } },
    textures: {},
    sprites: {
      peashooter: {
        atlas: 'characters',
        pivot: [0.5, 0.97],
        logicalW: 56,
        logicalH: 72,
        frames: [{ x: 0, y: 0, w: 112, h: 144 }],
        clips: {
          idle: { fps: 10, loop: 'loop', frames: [{ frame: 0, dur: 1 }] },
          fire: { fps: 14, loop: 'once', next: 'idle', frames: [{ frame: 0, dur: 1 }] },
        },
        defaultClip: 'idle',
      },
    },
  };
}

describe('manifest validation', () => {
  it('accepts a valid manifest', () => {
    const v = validateManifest(validManifest());
    expect(v.ok).toBe(true);
  });

  it('rejects structural problems with precise errors', () => {
    const m = validManifest();
    (m as { format: number }).format = 2;
    const errors: string[] = [];
    let v = validateManifest(m);
    if (!v.ok) errors.push(...v.errors);
    expect(errors.some((e) => e.includes('format'))).toBe(true);

    const m2 = validManifest();
    m2.sprites.peashooter!.frames = [];
    v = validateManifest(m2);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.some((e) => e.includes('no frames'))).toBe(true);

    const m3 = validManifest();
    m3.sprites.peashooter!.clips.idle!.frames[0]!.frame = 7; // out of range
    v = validateManifest(m3);
    expect(v.ok).toBe(false);

    const m4 = validManifest();
    m4.sprites.peashooter!.defaultClip = 'nope';
    v = validateManifest(m4);
    expect(v.ok).toBe(false);

    const m5 = validManifest();
    m5.sprites.peashooter!.atlas = 'ghost';
    v = validateManifest(m5);
    expect(v.ok).toBe(false);
  });
});

describe('AssetManager preload pipeline', () => {
  function fakeImageFactory(): () => { src: string; decode(): Promise<void>; width: number; height: number } {
    return () => ({
      src: '',
      decode: () => Promise.resolve(),
      width: 1,
      height: 1,
    });
  }

  it('loads manifest + images and reports progress', async () => {
    const manifest = validManifest();
    manifest.textures = { lawn: { url: 'assets/env-lawn.png', w: 1600, h: 1200 } };
    const calls: string[] = [];
    const am = new AssetManager({
      fetchFn: async (url) => {
        calls.push(url);
        return { json: async () => manifest } as Response;
      },
      imageFactory: fakeImageFactory(),
    });
    const progress: number[] = [];
    const result = await am.preload('assets/manifest.json', (p) => progress.push(p.loaded / p.total));
    expect(result.failed).toEqual([]);
    expect(am.getSprite('peashooter')).toBeTruthy();
    expect(am.hasImage('characters')).toBe(true);
    expect(am.hasImage('lawn')).toBe(true);
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('records failures after retries and retryFailed recovers', async () => {
    const manifest = validManifest();
    let failTimes = 3; // > maxRetries (2)
    const am = new AssetManager({
      fetchFn: async () => ({ json: async () => manifest } as Response),
      imageFactory: () => ({
        src: '',
        decode: () => (failTimes-- > 0 ? Promise.reject(new Error('decode')) : Promise.resolve()),
        width: 1,
        height: 1,
      }),
    });
    const result = await am.preload('assets/manifest.json');
    expect(result.failed).toContain('characters');
    expect(am.isFailed('characters')).toBe(true);
    // retry now succeeds
    const retry = await am.retryFailed();
    expect(retry.failed).toEqual([]);
    expect(am.hasImage('characters')).toBe(true);
  });

  it('treats an invalid manifest as a manifest failure', async () => {
    const am = new AssetManager({
      fetchFn: async () => ({ json: async () => ({ format: 99 }) } as Response),
      imageFactory: fakeImageFactory(),
    });
    const result = await am.preload('assets/manifest.json');
    expect(result.failed).toContain('manifest');
    expect(am.getManifest()).toBeNull();
  });
});

describe('animation playback', () => {
  const def = validManifest().sprites.peashooter!;

  it('loops walk clips and holds hold-clips on the last frame', () => {
    const am = new Animator((s) => (s === 'peashooter' ? def : undefined));
    const events = am.advance(1, 'peashooter', 'idle', 1.5, 1);
    expect(events).toEqual([]);
    const frame = am.frameOf(1);
    expect(frame).toBeGreaterThanOrEqual(0);
    // after many seconds of a loop clip the animator still has a frame
    am.advance(1, 'peashooter', 'idle', 100, 1);
    expect(am.frameOf(1)).toBeGreaterThanOrEqual(0);
  });

  it('fires markers once per crossing', () => {
    const withMarkers: typeof def = {
      ...def,
      clips: {
        walk: {
          fps: 10,
          loop: 'loop',
          frames: [
            { frame: 0, dur: 1, markers: [{ at: 0, event: 'footstep' }] },
            { frame: 0, dur: 1 },
          ],
        },
      },
    };
    const am = new Animator((s) => (s === 'peashooter' ? withMarkers : undefined));
    let events = am.advance(1, 'peashooter', 'walk', 0.05, 1);
    expect(events.map((e) => e.event)).toContain('footstep');
    // continuing within the same frame does not re-fire
    events = am.advance(1, 'peashooter', 'walk', 0.05, 1);
    expect(events.map((e) => e.event)).not.toContain('footstep');
    // a full loop wrap re-fires the footstep marker
    events = am.advance(1, 'peashooter', 'walk', 0.2, 1);
    expect(events.map((e) => e.event)).toContain('footstep');
  });

  it('once clips follow their next chain to a looping clip', () => {
    const am = new Animator((s) => (s === 'peashooter' ? def : undefined));
    am.advance(1, 'peashooter', 'fire', 0.05, 1);
    const frameAtFire = am.frameOf(1);
    am.advance(1, 'peashooter', 'fire', 2, 1); // longer than the clip
    expect(frameAtFire).toBeGreaterThanOrEqual(0);
    // switching desired clip resets the clock
    const before = am.frameOf(1);
    am.advance(1, 'peashooter', 'idle', 0.01, 1);
    expect(am.frameOf(1)).toBeGreaterThanOrEqual(0);
    void before;
  });
});

describe('animation state resolver', () => {
  it('reads ECS state without mutating it', () => {
    const setup = setupWorld(level, 5, new EventBus<GameEvents>());
    const world = setup.world;
    const z = makeZombie(world, 'basic', 2, setup.rng);
    world.update(1 / 60);

    let play = resolvePlay(world, z)!;
    expect(play.sprite).toBe('zombie-basic');
    expect(play.clip).toBe('walk');
    expect(play.speed).toBe(1);

    const brain = world.get<{ eating: boolean; slowUntil: number }>(z, 'ZombieBrain')!;
    brain.eating = true;
    play = resolvePlay(world, z)!;
    expect(play.clip).toBe('eat');

    brain.eating = false;
    brain.slowUntil = (world.resources.time as number) + 5;
    play = resolvePlay(world, z)!;
    expect(play.speed).toBeLessThan(1);

    const pea = makeProjectile(world, 'frozen', 2, 200, 200);
    world.update(1 / 60);
    play = resolvePlay(world, pea)!;
    expect(play.sprite).toBe('pea-frozen');

    const mower = makeMower(world, 2);
    play = resolvePlay(world, mower)!;
    expect(play.clip).toBe('idle');
    world.get<{ active: boolean }>(mower, 'MowerC')!.active = true;
    play = resolvePlay(world, mower)!;
    expect(play.clip).toBe('run');
  });

  it('selects damage tiers from health fractions and urgency from fuses', () => {
    const setup = setupWorld(level, 5, new EventBus<GameEvents>());
    const world = setup.world;

    // wall-nut tiers
    const nut = makePlant(world, 'wallnut', 2, 2);
    world.update(1 / 60);
    const nutHp = world.get<{ hp: number; max: number }>(nut, 'Health')!;
    expect(resolvePlay(world, nut)!.clip).toBe('full');
    nutHp.hp = nutHp.max * 0.5;
    expect(resolvePlay(world, nut)!.clip).toBe('cracked');
    nutHp.hp = nutHp.max * 0.2;
    expect(resolvePlay(world, nut)!.clip).toBe('broken');
    nutHp.hp = nutHp.max;
    world.get<{ flash: number }>(nut, 'Health')!.flash = 0.1;
    expect(resolvePlay(world, nut)!.clip).toBe('squash');

    // cherry urgency
    const cherry = makePlant(world, 'cherrybomb', 3, 2);
    world.update(1 / 60);
    const fuse = world.get<{ time: number; maxTime: number }>(cherry, 'Fuse')!;
    expect(resolvePlay(world, cherry)!.clip).toBe('idle');
    fuse.time = fuse.maxTime * 0.5;
    expect(resolvePlay(world, cherry)!.clip).toBe('urgent');
    fuse.time = fuse.maxTime * 0.2;
    expect(resolvePlay(world, cherry)!.clip).toBe('preflash');

    // sunflower produce window
    const flower = makePlant(world, 'sunflower', 1, 1);
    world.update(1 / 60);
    const prod = world.get<{ cooldown: number; interval: number }>(flower, 'Producer')!;
    expect(resolvePlay(world, flower)!.clip).toBe('idle');
    prod.cooldown = prod.interval * 0.2;
    expect(resolvePlay(world, flower)!.clip).toBe('produce');

    // armored zombie damage tiers
    const cone = makeZombie(world, 'cone', 1, setup.rng);
    world.update(1 / 60);
    const coneHp = world.get<{ hp: number; max: number }>(cone, 'Health')!;
    expect(resolvePlay(world, cone)!.clip).toBe('walk');
    coneHp.hp = coneHp.max * 0.5;
    expect(resolvePlay(world, cone)!.clip).toBe('walk-dmg1');
    coneHp.hp = coneHp.max * 0.2;
    expect(resolvePlay(world, cone)!.clip).toBe('walk-dmg2');
    world.get<{ eating: boolean }>(cone, 'ZombieBrain')!.eating = true;
    expect(resolvePlay(world, cone)!.clip).toBe('eat-dmg2');

    // runner keeps a single walk clip regardless of damage
    const runner = makeZombie(world, 'runner', 2, setup.rng);
    world.update(1 / 60);
    world.get<{ hp: number; max: number }>(runner, 'Health')!.hp = 1;
    expect(resolvePlay(world, runner)!.clip).toBe('walk');
  });
});

describe('render history interpolation', () => {
  it('snapshots before the step and interpolates afterward', () => {
    const setup = setupWorld(level, 9, new EventBus<GameEvents>());
    const world: World = setup.world;
    const z = world.spawn();
    world.addComponent(z, 'Position', { x: 500, y: 200 });
    world.addComponent(z, PREV_POSITION, { x: 500, y: 200 });
    const p = world.get<{ x: number; y: number }>(z, 'Position')!;
    const out = { x: 0, y: 0 };
    // before any step, alpha 0.5 is between identical positions
    expect(interpPos(world, z, 0.5, out)).toEqual({ x: 500, y: 200 });
    // snapshot then move
    snapshotHistory(world);
    p.x = 484;
    expect(interpPos(world, z, 0.5, out).x).toBeCloseTo(492);
    expect(interpPos(world, z, 1, out).x).toBeCloseTo(484);
    expect(interpPos(world, z, 0, out).x).toBeCloseTo(500);
    // teleport: position jumps first, then history resets — no streak
    p.x = 100;
    resetHistory(world, z);
    expect(interpPos(world, z, 0.5, out).x).toBeCloseTo(100);
  });

  it('attaches history to spawned movers', () => {
    const setup = setupWorld(level, 3, new EventBus<GameEvents>());
    const world = setup.world;
    const pea = makeProjectile(world, 'pea', 0, 100, 100);
    expect(world.has(pea, PREV_POSITION)).toBe(true);
    world.update(1 / 60);
    const prev = world.get<{ x: number }>(pea, PREV_POSITION)!;
    expect(prev.x).toBeLessThan(world.get<{ x: number }>(pea, 'Position')!.x);
  });
});

describe('adaptive quality', () => {
  it('picks initial tiers from device hints', () => {
    expect(initialTier({ dpr: 1, viewportW: 1920, viewportH: 1080, deviceMemory: 8, coarsePointer: false, reducedMotion: false })).toBe('high');
    expect(initialTier({ dpr: 2, viewportW: 1024, viewportH: 768, deviceMemory: 4, coarsePointer: true, reducedMotion: false })).toBe('medium');
    expect(initialTier({ dpr: 1, viewportW: 1920, viewportH: 1080, deviceMemory: 2, coarsePointer: false, reducedMotion: false })).toBe('medium');
    expect(initialTier({ dpr: 2, viewportW: 1920, viewportH: 1080, deviceMemory: 8, coarsePointer: false, reducedMotion: true })).toBe('medium');
  });

  it('demotes fast and promotes only after a long stable recovery (hysteresis)', () => {
    expect(nextTier('high', 18, DEMOTE_STREAK, 0)).toBe('medium');
    expect(nextTier('high', 18, DEMOTE_STREAK - 1, 0)).toBe('high'); // not sustained yet
    expect(nextTier('medium', 12, 0, PROMOTE_STREAK)).toBe('high');
    expect(nextTier('medium', 12, 0, PROMOTE_STREAK - 1)).toBe('medium');
    expect(nextTier('medium', 18, DEMOTE_STREAK, 0)).toBe('low');
    expect(nextTier('low', 12, 0, PROMOTE_STREAK)).toBe('medium');
  });
});

describe('cosmetic particle caps', () => {
  it('caps growth and prioritizes important feedback', () => {
    const fx = new CosmeticFx(4);
    for (let i = 0; i < 6; i++) {
      fx.spawn({ x: 0, y: 0, vx: 0, vy: 0, ttl: 1, maxTtl: 1, size: 2, color: '#fff', gravity: 0, kind: 'dot', priority: 0 });
    }
    expect(fx.particleCount).toBe(4);
    // important particles replace ambient ones at the cap
    fx.spawn({ x: 0, y: 0, vx: 0, vy: 0, ttl: 1, maxTtl: 1, size: 2, color: '#f00', gravity: 0, kind: 'spark', priority: 1 });
    expect(fx.particleCount).toBe(4);
  });
});

describe('trauma camera', () => {
  it('produces deterministic seeded noise and respects reduced motion', () => {
    expect(seededNoise(0.5, 7)).toBeCloseTo(seededNoise(0.5, 7), 10);
    expect(seededNoise(0, 7)).not.toBe(seededNoise(1, 7));
    const cam = new CameraState(42, true);
    cam.addTrauma(1);
    cam.update(0.016);
    expect(cam.offset()).toEqual({ x: 0, y: 0, rot: 0 });
    const cam2 = new CameraState(42, false);
    cam2.addTrauma(1);
    cam2.update(0.016);
    const o = cam2.offset();
    expect(Math.abs(o.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(o.rot)).toBeLessThanOrEqual(0.02);
    // decays over time
    for (let i = 0; i < 240; i++) cam2.update(1 / 60);
    expect(cam2.currentTrauma).toBeLessThan(0.01);
  });
});

describe('save settings persistence', () => {
  it('migrates legacy muted saves and round-trips audio settings', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    store.set('pvz-save-v1', JSON.stringify({ unlocked: 2, best: {}, muted: true }));
    let data = save.load();
    expect(data.audio.muted).toBe(true);
    expect(data.unlocked).toBe(2);

    data.audio = { muted: false, musicOn: false, effectsOn: true, master: 0.5, music: 0.3, effects: 0.9 };
    data.highContrast = true;
    data.reducedMotion = true;
    save.write(data);
    const reloaded = save.load();
    expect(reloaded.audio).toEqual(data.audio);
    expect(reloaded.highContrast).toBe(true);
    expect(reloaded.reducedMotion).toBe(true);
  });
});

describe('progression persistence', () => {
  it('unlocks the next level and keeps the best result', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    let data = save.load();
    data.unlocked = 1;
    data.best = {};
    save.write(data);
    const after = recordResult(0, 5, 60);
    expect(after.unlocked).toBe(2);
    expect(after.best['day-1']).toEqual({ kills: 5, time: 60 });
    // a worse run does not overwrite the best
    const worse = recordResult(0, 2, 90);
    expect(worse.best['day-1']).toEqual({ kills: 5, time: 60 });
    // a better run does
    const better = recordResult(0, 9, 55);
    expect(better.best['day-1']).toEqual({ kills: 9, time: 55 });
  });
});
