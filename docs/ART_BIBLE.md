# Art Bible — "Storybook Suburban Garden"

Original visual direction for the garden-defense game. Everything here is
original work; we do not trace, copy, or import any Plants vs. Zombies
artwork, logo, audio, font, or UI asset. See `docs/CREDITS.md` for
authorship and licensing.

## 1. The fiction

A bright summer afternoon in a lovingly-tended suburban garden. The view is
a fixed, slightly elevated front yard: house on the left, lawn stretching
right, sidewalk at the far edge. The mood is warm and storybook-painted —
soft where it should be soft, sharp where gameplay demands readability.

## 2. Master constants (must be consistent everywhere)

| Rule | Value |
|---|---|
| Logical resolution | 800 × 600, battlefield 4:3 |
| Asset scale | 2× logical (all baked frames doubled) |
| Light direction | Top-left (sun at ~ (690, 70) in scene space) |
| Highlight side | Upper-left edges |
| Contact shadow | Soft ellipse offset +3 x, +5 y from ground pivot |
| Outline ink | `#241a12` (warm dark), 1.6–2 px logical (3–4 px at 2×) |
| Outline style | `lineJoin: round`, closed silhouettes, colored inner outline allowed |
| Camera angle | Slightly elevated front view; characters stand on one ground-contact line |
| Ground line | Each sprite's pivot sits exactly at the character's ground contact |
| Character fps | 8–15 fps authored cadence; transforms interpolate at refresh rate |

## 3. Palette (logical values; baked at 2×)

**Sky & light**
- Sky top `#7fc4ec` → horizon `#e9f2d0`; sun glow `rgba(255,244,190,·)`
- Cloud `#ffffff` at 0.85 alpha, warm shadow `#d8e6ee`

**House & garden**
- Siding `#e8d8b0`, siding shadow `#d4bd8e`, trim `#a87a4a`, roof `#7a5a3a`
- Door `#6b4a2e`, window glass warm `#f5e2a0`
- Fence pickets `#c9a86a`, fence shadow `#a8874e`
- Sidewalk `#c8c0b0`, seam shadow `rgba(0,0,0,0.10)`

**Lawn**
- Grass base `#5f9e46`, mowing stripe light `#6cb14e`, stripe dark `#57903f`
- Soil border `#8a6742`, soil dark `#6f5232`, stone `#b8ae98`
- Weeds `#7ec850` / `#67a83c`, flowerbed dot accents `#ffd84d` / `#ff9d5c`

**Plants (saturated, friendly)**
- Peashooter body `#4caf50`, shade `#2f8f2f`, snout `#7be07b`, leaf `#3fae3f`
- Snow pea body `#6fc3e8`, shade `#3a7fae`, snout `#a8ddf2`
- Sunflower petals `#ffd23f` rim `#d89f1e`, face `#8b5a2b`, eye ink `#3a2410`
- Wall-nut shell `#c98a4b`, rim `#7a4e22`, nut `#a8793f`
- Cherry `#e33b3b` / `#d83232`, rim `#8a1c1c`, stem `#2f8f2f`

**Zombies (muted, desaturated)**
- Skin `#a8b98a`, skin shade `#6f7f5a`, sickly accent `#93a271`
- Shirt `#5a4a3a`, pants `#3e382e`, tie `#8a3b2e`, shoes `#2e2a24`
- Accessory cone `#d8823c` shade `#a05a20`, bucket `#9aa0a6` shade `#6a7076`
- Frozen tint overlay `#9fd8ff` at 0.35, rim light `#cfeaff`

**FX & UI**
- Sun `#ffd84d`, rim `#e8a92e`, glow `rgba(255,230,100,·)`
- Pea `#63c93c` rim `#3f8f28`; frozen pea `#7fd4ff` rim `#4a9cc8`
- Explosion core `#fff4d0` → `#ffb14d` → `#ff8844` → smoke `#8a8a86`
- UI wood `#6b4a2e` / `#4c321e`, paper `#f2e2b8`, sun badge `#e8a92e`
- Ink on UI `#241a12`; danger `#c83a2a`; success `#4c9a3e`

## 4. Silhouette & readability rules

1. **Chunky silhouettes**: every character reads instantly at 25% size.
2. **Expressive faces**: large eyes (white sclera + dark pupil + tiny catch
   light), brows, and a clear mouth; faces sit on the sunlit side.
3. **One outline weight** per asset class; never mix hairlines with heavy
   rims inside a single character.
4. **Two-tone shading + painted texture**: flat base, one darker shade on
   the lower-right (away from light), plus seeded speckle noise and soft
   radial gradients. No photographic textures.
5. **Ground contact**: characters never float. Contact shadows anchor every
   entity; projectiles fly above their own tiny shadow.
6. **Plants vs zombies contrast**: plants are saturated and curvy; zombies
   are desaturated, angular, and droop. Frozen state adds a blue rim light
   and visible vapor — never color alone.

## 5. Camera & motion language

- One consistent camera angle; characters bob along it, never rotate in 3D.
- Trauma-based shake only: explosions and mowers add trauma; shake decays
  exponentially and is disabled under `prefers-reduced-motion`.
- Background parallax is subtle (≤ 6 px) so gameplay readability never
  suffers; cloud shadows drift slowly and dim the lawn by at most 8%.

## 6. Environment layers (back to front)

1. Sky (gradient + painted clouds + sun glow)
2. Distant clouds (parallax, drifting)
3. House + porch + fence + sidewalk (static, baked)
4. Lawn (mowing stripes instead of a checkerboard; faint planting dots;
   soil border, stones, weeds)
5. Cloud shadow band (procedural, drifting, additive dark)
6. Entities: contact shadows → plants/zombies/suns sorted by y → projectiles
   → particles in effect layer → floating text
7. Foreground foliage (baked, top corners optional vignette)
8. Lighting pass (warm tint, major-wave alert tint, explosion flash)

## 7. UI language

- "Garden tool" interface: painted wood panels, paper seed packets with
  portrait art, stamped cost badges, cloth-tag tooltips.
- States must read without color: selected (lift + sun-glow ring), disabled
  (dim + lock glyph), cooling down (vertical veil + numeric last-second
  countdown), affordable (cost badge brightens).
- Wave bar is a lawn path: a mower marker at "now", zombie markers for
  incoming waves, red flags for major waves.
- Touch targets ≥ 44 CSS px; keyboard focus rings; aria-labels on every
  control; high-contrast mode darkens outlines and lightens text.
