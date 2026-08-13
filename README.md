# Plants vs Zombies (browser game)

A fan-made, procedurally-rendered Plants vs Zombies-style tower defense game.
TypeScript + Vite + Canvas 2D, no runtime dependencies, no image/audio assets.

## Run it

```bash
pnpm install
pnpm dev        # dev server (prints a localhost URL)
pnpm test       # unit + headless simulation tests
pnpm build      # typecheck + production bundle in dist/
pnpm preview    # serve the production bundle
```

## How to play

- Goal: survive every wave. A zombie that reaches the house (after the row's
  lawn mower is spent) ends the run.
- **Sun** is the currency: it falls from the sky and Sunflowers produce it.
  Click a sun to collect it.
- Pick a seed card (or press **1–5**) and click a lawn cell to plant. You can
  plant during the opening countdown.
- **Shovel** (button or **S**) digs up a plant. **Esc** pauses.
- Plants: Sunflower (produces sun), Peashooter (shoots peas), Snow Pea
  (shoots + slows zombies), Wall-nut (huge hp blocker), Cherry Bomb
  (explodes in a 3×3 area after a short fuse).
- Beat a level to unlock the next. Best results persist in localStorage.

## Architecture

| Layer | Where | What |
|---|---|---|
| Engine (game-agnostic) | `src/core/` | fixed-timestep `Loop`, lightweight ECS `World`, typed `EventBus`, `Input`, procedural `Audio`, `Save`, `GameView` (letterboxed canvas), `SceneManager` |
| Game data | `src/game/content.ts` | **all** plants, zombies, projectiles and the 3 levels as data tables |
| Simulation | `src/game/systems.ts` | ordered, headless systems: clock → index → wave → sun → plants → zombies → projectiles → mowers → particles → health → lose |
| Entities | `src/game/factory.ts` | component assembly (`makePlant`, `makeZombie`, `makeSun`, …) |
| World bootstrap | `src/game/setup.ts` | `setupWorld(level, seed, events)` — shared by live play and tests |
| Rendering | `src/game/render/` | pre-rendered board background + procedural painters per entity (no assets) |
| UI | `src/game/ui/hud.ts` | DOM overlay: seed bank, sun counter, progress bar, banners |
| Scenes | `src/game/scenes/` | menu, level select, game, result |

**Key invariants**

- Systems depend only on `(world, dt)` — never DOM/canvas/audio. All game
  logic runs headless in Vitest (see `tests/game.test.ts`).
- Rendering reads components and never mutates state.
- UI reacts to events from `EventBus`; input intents (plant/dig/collect)
  are validated in the scene before mutating the world.
- Each level gets a seeded RNG: runs are reproducible for testing.

## Adding content

- **New plant/zombie**: add a row to `PLANTS`/`ZOMBIES` in
  `src/game/content.ts` (+ an optional painter in
  `src/game/render/painters.ts` and icon entry in `drawIcon`).
- **New level**: append a `LevelDef` to `LEVELS`. Waves are declarative
  schedules of zombie spawns; flags mark banner waves.
- **Balance**: all numbers (costs, hp, dps, speeds, sun cadence, wave
  composition) live in `content.ts`.

## Testing

- `tests/core.test.ts` — engine: ECS lifecycle, RNG determinism, math, events, save.
- `tests/game.test.ts` — headless sims: waves, zombie eating DPS, projectiles,
  slow, cherry AoE, mowers, sunflower production, win/lose, determinism.
- `tests/painters.test.ts` — every render branch executed against a mock canvas.
