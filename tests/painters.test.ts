import { describe, expect, it } from 'vitest';
import { AssetManager } from '../src/core/AssetManager';
import { EventBus } from '../src/core/EventBus';
import type { LevelDef } from '../src/game/content';
import type { GameEvents } from '../src/game/events';
import { burst, makePlant, makeProjectile, makeSun, makeZombie } from '../src/game/factory';
import { Animator } from '../src/game/anim/playback';
import { RENDER_PROFILES } from '../src/game/anim/types';
import { CosmeticFx } from '../src/game/render/fx';
import { paintEntity } from '../src/game/render/renderer';
import type { RenderCtx } from '../src/game/render/renderer';
import { drawSeedPortrait, drawToolIcon } from '../src/game/ui/icons';
import { setupWorld } from '../src/game/setup';

/** Proxy-based canvas context: accepts every call, returns dummy gradients. */
function mockCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const target = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
        if (prop === 'measureText') return () => ({ width: 0 });
        return () => {};
      },
      set() {
        return true;
      },
    },
  );
  return target as unknown as CanvasRenderingContext2D;
}

const level: LevelDef = {
  id: 'paint-test',
  name: 'paint',
  initialSun: 9999,
  startDelay: 0,
  skySun: { first: 9999, min: 9999, max: 9999 },
  allowedPlants: ['sunflower', 'peashooter', 'snowpea', 'wallnut', 'cherrybomb'],
  waves: [{ zombies: [{ kind: 'basic', at: 9999 }], gap: 0 }],
};

describe('painters (all render branches run headless)', () => {
  it('paints every entity kind without throwing (no assets → fallback art)', () => {
    const setup = setupWorld(level, 11, new EventBus<GameEvents>());
    const world = setup.world;
    const grid = setup.grid;

    grid[0]![0] = makePlant(world, 'sunflower', 0, 0);
    grid[1]![1] = makePlant(world, 'peashooter', 1, 1);
    grid[2]![2] = makePlant(world, 'snowpea', 2, 2);
    grid[3]![3] = makePlant(world, 'wallnut', 3, 3);
    grid[4]![4] = makePlant(world, 'cherrybomb', 4, 4);
    makeZombie(world, 'basic', 0, setup.rng);
    makeZombie(world, 'cone', 1, setup.rng);
    makeZombie(world, 'bucket', 2, setup.rng);
    makeZombie(world, 'runner', 3, setup.rng);
    makeZombie(world, 'flag', 4, setup.rng);
    makeProjectile(world, 'pea', 0, 200, 130);
    makeProjectile(world, 'frozen', 1, 200, 230);
    makeSun(world, 400, 200, 25);
    burst(world, 300, 300, '#fff', 6, 100);

    // Advance so a peashooter fires, a sunflower produces and the cherry fuses.
    const steps = Math.floor(3 / (1 / 60));
    for (let i = 0; i < steps; i++) world.update(1 / 60);

    const assets = new AssetManager();
    const animator = new Animator((s) => assets.getSprite(s));
    const fx = new CosmeticFx(200);
    const rc: RenderCtx = {
      ctx: mockCtx(),
      assets,
      animator,
      fx,
      battlefield: { contactShadow: () => {} } as unknown as RenderCtx['battlefield'],
      quality: RENDER_PROFILES.high,
      lighting: { warm: 0, alert: 0, flash: 0 },
      alpha: 0.5,
    };
    for (const e of world.query('Renderable', 'Position')) {
      expect(() => paintEntity(rc, world, e)).not.toThrow();
    }
    // Zombies in eating and slowed states exercise those branches too.
    const z = world.query('ZombieInfo')[0];
    if (z) {
      const brain = world.get<{ eating: boolean }>(z, 'ZombieBrain')!;
      brain.eating = true;
      expect(() => paintEntity(rc, world, z)).not.toThrow();
    }
    // Icons: every tool + plant portrait + unknown fallback.
    const ictx = mockCtx();
    for (const kind of ['sun', 'shovel', 'pause', 'sound-on', 'sound-off', 'flag', 'lock', 'zombie', 'unknown'] as const) {
      expect(() => drawToolIcon(ictx, assets, kind)).not.toThrow();
    }
    for (const kind of ['sunflower', 'peashooter', 'snowpea', 'wallnut', 'cherrybomb', 'nope']) {
      expect(() => drawSeedPortrait(ictx, assets, kind)).not.toThrow();
    }
  });

  it('paints baked sprites when the manifest is available', () => {
    // A fake manifest-shaped asset source: sprite exists but the image is
    // missing → sprite path must fail gracefully back to fallback art.
    const setup = setupWorld(level, 7, new EventBus<GameEvents>());
    const world = setup.world;
    makeZombie(world, 'basic', 0, setup.rng);
    world.update(1 / 60);
    const fake = {
      getSprite: () => ({
        atlas: 'characters',
        pivot: [0.5, 0.98] as [number, number],
        logicalW: 56,
        logicalH: 72,
        frames: [{ x: 0, y: 0, w: 112, h: 144 }],
        clips: { walk: { fps: 8, loop: 'loop', frames: [{ frame: 0, dur: 1 }] } },
        defaultClip: 'walk',
      }),
      getImage: () => undefined,
    };
    const animator = new Animator((s) => (fake as unknown as AssetManager).getSprite(s));
    const rc: RenderCtx = {
      ctx: mockCtx(),
      assets: fake as unknown as AssetManager,
      animator,
      fx: new CosmeticFx(),
      battlefield: { contactShadow: () => {} } as unknown as RenderCtx['battlefield'],
      quality: RENDER_PROFILES.high,
      lighting: { warm: 0, alert: 0, flash: 0 },
      alpha: 0,
    };
    for (const e of world.query('Renderable', 'Position')) {
      expect(() => paintEntity(rc, world, e)).not.toThrow();
    }
  });
});
