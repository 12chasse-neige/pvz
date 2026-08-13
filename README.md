# Garden Defense (browser game)

An original, storybook-styled garden-defense game. TypeScript + Vite +
Canvas 2D. All artwork is original (generatively painted by the project's
own art modules and baked into sprite atlases); all audio is synthesized at
runtime. See `docs/ART_BIBLE.md` and `docs/CREDITS.md`.

## Run it

```bash
pnpm install
pnpm bake       # regenerate sprite atlases + manifest into public/assets/
pnpm dev        # dev server (prints a localhost URL)
pnpm test       # unit + headless simulation tests
pnpm build      # typecheck + production bundle in dist/
pnpm preview    # serve the production bundle
pnpm smoke      # headless-browser boot smoke test (needs Chromium, see below)
```

Smoke-test browser (one-time):

```bash
PLAYWRIGHT_BROWSERS_PATH=.pw-browsers pnpm exec playwright install chromium
pnpm smoke
```

## How to play

- Goal: survive every wave. A zombie that reaches the house (after the row's
  lawn mower is spent) ends the run.
- **Sun** is the currency: it falls from the sky and Sunflowers produce it.
  Click a sun to collect it — it flies to the counter before it counts.
- Pick a seed packet (or press **1–5**) and click a lawn cell to plant. You
  can plant during the opening countdown.
- **Shovel** (button or **S**) digs up a plant. **Esc** pauses.
- Plants: Sunflower (produces sun), Peashooter (shoots peas), Snow Pea
  (shoots + slows zombies), Wall-nut (huge hp blocker), Cherry Bomb
  (explodes in a 3×3 area after a short fuse).
- Beat a level to unlock the next. Best results persist in localStorage.

## Architecture

| Layer | Where | What |
|---|---|---|
| Engine (game-agnostic) | `src/core/` | fixed-timestep `Loop`, lightweight ECS `World`, typed `EventBus`, `Input`, Web Audio `Audio` (music + SFX), `Save`, `GameView` (letterboxed canvas), `SceneManager` (with fade transitions), `AssetManager` (preload pipeline with validation/retry) |
| Game data | `src/game/content.ts` | **all** plants, zombies, projectiles and the 3 levels as data tables |
| Simulation | `src/game/systems.ts` | ordered, headless systems (unchanged balance/collision/wave timing) |
| Entities | `src/game/factory.ts` | component assembly (`makePlant`, `makeZombie`, `makeSun`, …) |
| World bootstrap | `src/game/setup.ts` | `setupWorld(level, seed, events)` — shared by live play and tests |
| Source art | `src/art/` | editable, procedurally-painted artwork (palette, characters, environment, UI) — doubles as the runtime fallback painters |
| Asset pipeline | `scripts/bake-assets.ts` | renders every frame at 2×, measures exact bounds/pivots, packs atlases, writes `public/assets/*.png` + typed `manifest.json` |
| Animation | `src/game/anim/` | typed `SpriteAtlasDef`/`AnimationClip`/`AnimationFrame`/`RenderProfile`, clip playback with frame markers, ECS→animation-state resolver |
| Rendering | `src/game/render/` | layered `Battlefield` (parallax, cloud shadows, cached gradients), sprite painter with contact shadows + status overlays, trauma camera, cosmetic FX pool (capped particles, death actors, flyers), adaptive `QualityManager`, prev/current position interpolation |
| UI | `src/game/ui/hud.ts` | DOM HUD: paper seed packets, painted tool icons, lawn-path wave bar, sun counter pop |
| Scenes | `src/game/scenes/` | loading (progress/retry), menu, level select, game, result |
| Smoke | `scripts/smoke.ts` | Playwright boot test: screenshots + console-error assertions + FPS probe |

**Key invariants**

- Systems depend only on `(world, dt)` — never DOM/canvas/audio. All game
  logic runs headless in Vitest (see `tests/game.test.ts`).
- Rendering reads components and never mutates simulation state (the one
  exception: `PrevPosition` history is cosmetic data only).
- UI reacts to events from `EventBus`; input intents (plant/dig/collect)
  are validated in the scene before mutating the world.
- Each level gets a seeded RNG: runs are reproducible for testing.
- Quality tiers (high/medium/low) adapt to sustained frame times with
  hysteresis and never touch simulation rate, collision or wave timing.
- Missing assets never crash: painters fall back to procedural art.

## Adding content

- **New plant/zombie**: add a row to `PLANTS`/`ZOMBIES` in
  `src/game/content.ts` (+ an optional painter in `src/game/render/painters.ts`).
- **New sprite**: add art + clip definitions to `scripts/bake-assets.ts`,
  run `pnpm bake`, and map it in `src/game/anim/resolver.ts`.
- **New level**: append a `LevelDef` to `LEVELS`. Waves are declarative
  schedules of zombie spawns; flags mark banner waves.
- **Balance**: all numbers (costs, hp, dps, speeds, sun cadence, wave
  composition) live in `content.ts`.

## Testing

- `tests/core.test.ts` — engine: ECS lifecycle, RNG determinism, math, events, save.
- `tests/game.test.ts` — headless sims: waves, zombie eating DPS, projectiles,
  slow, cherry AoE, mowers, sunflower production, win/lose, determinism.
- `tests/painters.test.ts` — every render branch executed against a mock canvas.
- `tests/render.test.ts` — manifest validation, asset loading/retry,
  animation playback + markers, state resolver, interpolation history,
  quality hysteresis, particle caps, camera determinism, save migration.
- `pnpm smoke` — boot smoke test in headless Chromium (screenshots to
  `.artifacts/`).
