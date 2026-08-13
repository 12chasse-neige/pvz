# Credits & Licenses

All visual and audio content in this project is **original**, authored in
this repository, unless noted otherwise.

## Artwork

- All sprites, environment layers, and UI art are painted procedurally by
  the project's own art modules under `src/art/` (editable source artwork)
  and baked into optimized atlases under `public/assets/` (runtime
  artifacts — generated, not hand-edited).
- Author: the pvz project (generative art pipeline).
- License: public domain dedication (CC0 1.0) for the baked assets.
  See https://creativecommons.org/publicdomain/zero/1.0/

No artwork, logo, or UI asset from Plants vs. Zombies (or any other game)
is used, copied, or imported. This project is an original fan-style game
sharing only the unprotected game-genre concept.

## Audio

- All sound effects and music loops are synthesized at runtime with the
  Web Audio API from original oscillator/noise designs in
  `src/core/Audio.ts` — no audio files are imported or reused.
- Author: the pvz project. License: CC0 1.0 (original composition).

## Fonts

- The interface uses the system font stack
  (`Trebuchet MS`, `Segoe UI`, system-ui, sans-serif). No font file is
  bundled; rendering is provided by the user's operating system, so no
  redistribution license applies. Typeface choice was made for a warm,
  rounded, storybook feel.
