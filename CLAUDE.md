# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Roadmap anchor

The **Current status** section below is the live source of truth for where the project
is and what's next. A retrospective written after v0.16.0 (the save system) remains
useful for *historical* context:

- **English:** `docs/retrospective.md`
- **Slovak:** `docs/retrospective.sk.md` (gitignored)

## Testing discipline (satisfied — keep it green)

The standing bar: every module ships with its own `*.tests.ts`, every exported
function/type has at least one test, and `npm test` stays at **≥ 75% line coverage**
(currently ~97%; the threshold is enforced in `vitest.config.ts` and gates every release
via `npm run test:coverage` in CI). This bar is **met** — new modules are fine **provided each ships with
its own tests** at the same standard. The only work that may skip tests-first is fixing
a bug that is actively breaking something.

**Do not add** `physics.ts`, `particle.ts`, network, or multiplayer modules. Spectrum
philosophy: less is more.

## Current status

`zx-kit` **0.38.x** is a published npm package (semantic-release on push to `main`) — **29 test files / ~1017 tests, ~97% line coverage**. It ships compiled JS + `.d.ts` from `dist/` and exports **everything** — including `cache`, `attrscreen`, `monoscreen`, `music`, `presentation` — from `./dist/index.js` (root export only; subpaths are not exposed, and don't need to be). No Vite aliases or path hacks.

Flagship consumers — the two games that carry the whole kit and **are** its demo (there is no separate showcase build): **chaosBunny** (`/Users/zrebec/Projects/retro/games/chaosbunny`, on `^0.37.1`) cycles four playfield looks (fantasy bricks/black → mono anti-clash → authentic attr clash) through a small `Painter` adapter — the proof the rendering core holds together; **Minefield** is the reference integration for new primitives (`save`, `rng` daily seed, `presentation`) and the first consumer for anything new.

**Next: the GLOW attribute (owner-approved — full plan in "GLOW attribute" below), then stabilisation.** GLOW is the kit's one **sanctioned** new module despite the "less is more" rule — the owner green-lit it 2026-06-11 as the "wow" feature and scheduled the build for the 2026-07-22 → next session. Apart from GLOW, the library is feature-complete for its scope; the remaining work is docs/packaging hygiene and public-API stabilisation toward 1.0 — not engine surface. Done already: tests no longer ship in `dist`; `.gitattributes` locks line endings to LF; and the **README split (K4) is complete** — the former ~3k-line README is now a 271-line landing page plus `docs/{getting-started,rendering,audio,collision,save,api,examples}.md`. Next up: public-API stabilisation (stable/experimental classification, deprecation policy) toward 1.0. **No flagship "kitchen-sink" demo or GitHub Pages landing — that idea (K5) is dropped; Minefield and chaosBunny are the demo.** See `retro/docs/portfolio/tasks_all_projects.md` (K-items) for the live list, and `retro/docs/sk/zx-kit.md` for the consolidated SK working doc.

## GLOW attribute — implementation plan (owner-approved, NEXT task)

> **Status:** approach approved 2026-06-11 (path B); detailed 2026-07-22; **core + Option 1 SHIPPED
> 2026-07-23 on branch `feature/glow`** (`src/glow.ts` + `tests/glow.tests.ts`, glow 100% lines / 92% branch,
> 1028 tests green; index + api-stability + rendering.md updated). Purely additive/opt-in — a game that
> never calls it is unaffected (owner's guarantee). **Still open (Option 2, second PR):** the `cellGlow`
> bit in `attrscreen.ts` (the "attribute bit like FLASH" for chaosBunny). This is the one sanctioned new
> module (overrides "no new modules" above — owner green-lit). Origin/spec notes:
> `retro/docs/portfolio/tasks_all_projects.md` (K14) + `retro/docs/sk/zx-kit.md` (K14 row) + chaosBunny
> `docs/new_feel.md` ch. 6½. **Grok's take + Claude's review (where they differ):**
> `retro/docs/sk/glow_by_grok.md`. **Confirmed owner choices (2026-07-23):** feed = callback (Option 1)
> first; intensity = **scaled per-source** (`GlowSource.intensity`, like `Light`); bloom = the source's
> **own colour** (no white-only); first consumer = **Minefield radar/sonar**.

### The idea (path B — emissive, NOT a palette entry)
An optional **glow** marker in the spirit of the Spectrum's FLASH attribute bit: a pixel/cell **keeps its
exact 15-palette colour** — glow only flags it **emissive**. A presentation-layer **bloom** then lets
emissive pixels bleed into neighbours; overlapping haloes sum into *perceived* "new colours" **on the
glass only**, while the framebuffer's flat 15-colour palette stays untouched. **Only light *sources* glow**
(torch, moon, crystal, sonar blip, radar sweep) — never the things they light. **Path A was rejected**:
making glow a *lighter flat colour* would dilute the palette to ~22–30 colours (an Amstrad look).

### The bloom pipeline (core — cheap, no WebGL)
A **downscale → upscale → additive-blend** bloom in 2–3 `drawImage` calls on an offscreen canvas — the same
"one offscreen buffer, blit once, headless-safe" discipline as `lighting.ts` (GLOW is the **additive twin**
of lighting's **subtractive** darkness):
1. **Emissive layer** — a view-sized offscreen canvas cleared to black each frame; **only the glow sources**
   are drawn into it in their palette colours (everything else black).
2. **Blur = downscale + upscale.** Draw the emissive layer into a small buffer (e.g. ¼ size), then draw it
   back up to full size with **`imageSmoothingEnabled = true`** — the browser's bilinear filter *is* the
   blur, for free. (The ONE place in the kit smoothing is on; restore it off after.) Optional 2 passes at
   different scales = wider/softer halo.
3. **Additive composite.** Blit the blurred buffer onto the main canvas with
   **`globalCompositeOperation = 'lighter'`** at a low `globalAlpha` (≈0.4–0.6): overlapping haloes sum →
   the perceived extra colours; the sharp source pixels brighten (the emissive look), the base scene under
   them untouched. All knobs (downscale, passes, alpha) are params with defaults — eye-tuned by the owner.

**Perf:** 2–3 `drawImage`/frame at device res; the emissive layer only repaints when a source moves — if it
ever bites, borrow `lighting.ts`'s per-cell dirty-tracking (sources are few, a full repaint is likely fine).
**Headless-safe:** no `document` → offscreen canvases `null`, pure maths still runs (testable), blit skipped
— mirror `attrscreen.ts` / `lighting.ts`.

### Where it lives + how the game feeds it (the fork — owner picks at build time)
Core = a new module **`glow.ts`** (`createGlowLayer` + `renderGlow`) owning the bloom. What differs is **how
the game marks emissive pixels** — three non-exclusive options:
- **Option 1 — emissive callback / source list (RECOMMENDED first).** Like `lighting.ts`'s `darknessAt`
  inversion: the game draws its glow sources into the layer's offscreen canvas via a
  `drawSources(sctx => …)` callback, OR passes a `Light[]`-style list the module renders as soft blobs.
  **Decoupled from how the scene is drawn** → works for direct-draw games (Minefield radar, Nautilus sonar)
  AND clash-mode games. Ship first; unblocks everyone.
- **Option 2 — a real glow bit in `attrscreen.ts` (the "like FLASH" one).** Add `cellGlow: Uint8Array` to
  `AttrScreen` + `glow?: boolean` on `stampMono`; a `flushGlow(ctx, scr, glowLayer)` derives the emissive
  layer from glowing cells automatically. The authentic "glow bit in the attribute grammar", best for
  chaosBunny (already on `AttrScreen`). Builds on Option 1's core.
- **Option 3 — per-cell glow flag in `AttrMap`/`drawBitmapAttrs`.** Per-sprite glow for `AttrMap` games.
  Lowest priority; add only when a game needs it.

**Recommendation:** build **`glow.ts` core + Option 1** in one pass (M), then wire **Option 2** into
`attrscreen.ts` as a thin adapter (the owner's "attribute bit" intent, for chaosBunny). Option 3 later.

### API sketch (functional — `createX` + ops, kit style)
```ts
// glow.ts
export interface GlowOptions { downscale?: number; passes?: number; alpha?: number }  // blur strength / halo width / blend
export interface GlowLayer {
  readonly width: number; readonly height: number
  readonly source: HTMLCanvasElement | null   // emissive canvas (black + sources); null headless
  readonly blur:   HTMLCanvasElement | null    // downscale buffer
}
export function createGlowLayer(width: number, height: number, opts?: GlowOptions): GlowLayer
export function renderGlow(                    // draw sources → blur → additive-blit onto ctx
  layer: GlowLayer, ctx: CanvasRenderingContext2D,
  drawSources: (sctx: CanvasRenderingContext2D) => void,
): void
export function glowBufferSize(width: number, height: number, downscale: number): { w: number; h: number } // pure, tested
// Option 2 later: AttrScreen.cellGlow, stampMono(..., { glow }), flushGlow(ctx, scr, layer)
```

### Render order (game loop)
scene (flat palette) → **`renderGlow`** (additive bloom over the sources) → `drawScanlines` → `curveDisplay`
(CSS). With `lighting.ts` darkness too: **darkness first** (dims non-lit), **then glow** (blooms the sources)
— subtractive/additive pair around the same light positions. **Do NOT build a unified `crt.ts` now** — keep
glow a standalone composable (kit philosophy); a future `crt.ts` bundling bloom+scanlines+vignette is a
separate, later call.

### Files
New `src/glow.ts` + `tests/glow.tests.ts` · `src/index.ts` (`export * from './glow.js'`) · this module map +
`docs/api-stability.md` (glow = Experimental at first) · `README.md`/`docs/rendering.md` short section.
Option 2 later: `src/attrscreen.ts` (+ tests).

### Tests (headless, kit bar ≥75% line / 100% func — mock 2D ctx like attrscreen/renderer tests)
`glowBufferSize` + any pure maths (dims, clamps of downscale/passes/alpha) · `createGlowLayer` allocates
buffers, headless → `null`, no throw · `renderGlow`: with a fake ctx capturing `drawImage`/
`globalCompositeOperation`/`globalAlpha`, assert it draws sources, downscales, upscales with smoothing on,
blends `'lighter'` at the given alpha, restores smoothing — and is a silent no-op headless.

### Effort / risks / open questions
**Effort M** (0.5–1.5 d): core + Option 1 + tests + a tiny example; Option 2 adds ~S.
**Risks:** (a) `'lighter'` washes the core toward white at high alpha → keep alpha low, eye-tune; (b) toggle
`imageSmoothingEnabled` ONLY for the blur draw and restore (kit is smoothing-off elsewhere); (c) bloom over
vs under scanlines changes the look — tune; (d) mobile fill-rate → downscale keeps it cheap, dirty-tracking
is the fallback.
**Open (decide at build):** 1) Option 1 first? (yes). 2) intensity flat per-source or scaled like `Light`?
3) bloom takes the **source's own colour** (a red radar blooms red) — confirm no white-only. 4) first demo
consumer — Minefield radar/sonar, chaosBunny torch/moon, or Nautilus sonar?
**Consumers (cross-project multiplier):** chaosBunny (torches/moon/lantern), Nautilus2K (sonar ping),
Minefield (radar sweep), future **aga-kit** (256-colour space wants real bloom). Build once, five projects light up.

## Volume control (shipped in 0.34.0)

Built-in volume control shipped in **0.34.0**: `initInput` maps `+`/`-` to
`increaseVolume()`/`decreaseVolume()` by default (remap via `setVolumeKeys(up, down)`,
disable with `setVolumeKeys([], [])`), and the auto-hide HUD bar is `setVolumeBarStyle(opts)`
once + `drawVolumeBar(ctx)` in the render loop (shows ~1.5 s after a change, then hides).
This is a **deliberate break from ZX authenticity** (the Speccy had no SW volume) — an
"under glass, 2026" affordance like `curveDisplay`/scanlines. **Minefield adopted** (its
per-game volume code is deleted); **chaosBunny adoption is still pending**.

## Build

```bash
npm run build          # tsc → dist/
npm test               # vitest run (fast, no coverage)
npm run test:coverage  # vitest run --coverage — enforces the 75% thresholds (used by CI)
```

`tsconfig.json` emits to `dist/` with `declaration: true`, `declarationMap: true`, `sourceMap: true`.

## Module map

All modules re-exported through the barrel `src/index.ts`:

| Module | Key exports |
|--------|-------------|
| `palette.ts` | `SCALE=4`, `CELL=8`, `C` (15-color object), `SpectrumColor` type |
| `font.ts` | `FONT` (96-char ROM bitmap), `getCharRow()` |
| `renderer.ts` | `setupCanvas`, `curveDisplay`, `mirrorSprite`, `drawSprite`, `drawChar`, `drawText`, `drawTextCentered`, `drawScanlines`, `drawShade`, `DITHER`, `createBitmap`, `drawBitmap`, `mirrorBitmap`, `createAttrMap`, `drawBitmapAttrs`, `mirrorAttrMap`, `flashBorder` |
| `audio.ts` | `initAudio`, `resumeAudio`, `beep`, `playPattern`, `getAudioContext`, `getMasterGain`, `getMasterVolume`, `setMasterVolume`, `increaseVolume`, `decreaseVolume`, `setVolumeBarStyle`, `drawVolumeBar`, `VolumeBarStyleOptions` |
| `ay.ts` | `createAY`, `playAY`, `AY_CLOCK`, `AY_VOL`, `AY_ENVELOPE_SHAPES`, `AYChannel`, `AYNote`, `AYChip` (incl. `pan`/`setStereoMode`/`volume`/`fade`), `AYHandle`, `AYStereoMode` |
| `aydump.ts` | `parsePSG`, `loadPSG`, `playAYDump`, `renderAYDump`, `AYChipCore`, `AYDumpPlayer`, `AY_MACHINE`, `AYDump`, `AYDumpHandle`, `AYChipConfig`, `AYChipVariant` — PSG register-dump player (sample-accurate AudioWorklet chip emulator; reuses `ay.ts` `AY_VOL`/`AY_CLOCK`/`AYStereoMode` + `audio.ts` master gain) |
| `input.ts` | `initInput`, `tickMovement`, `consumeFlag`, `consumeDebug`, `consumePause`, `consumeAnyKey`, `isHeld`, `resetInput`, `setVolumeKeys`, `Direction` |
| `sprite.ts` | `createSprite`, `moveSprite`, `applyGravity`, `renderSprite`, `Sprite` |
| `collision.ts` | `spriteRect`, `bitmapRect`, `rectsOverlap`, `spritesOverlap`, `isSolidAt`, `resolveRectX`, `resolveRectY`, `resolveX`, `resolveY`, `Rect`, `bitmapPixelMask`, `masksOverlap`, `pixelSolidCount`, `PixelMask` |
| `particles.ts` | `createParticleSystem`, `emitParticles`, `tickParticles`, `renderParticles`, `clearParticles`, `Particle`, `ParticleSystem`, `EmitOptions`, `Ranged` |
| `rng.ts` | `createRng`, `hashSeed`, `Rng` (seeded mulberry32: int/range/float/pick/shuffle/fork) |
| `animation.ts` | `createAnimation`, `tickAnimation`, `getAnimationFrame`, `resetAnimation`, `createTween`, `tickTween`, `createBlinker`, `tickBlinker`, `Animation`, `Tween`, `Blinker`, `Easings` |
| `camera.ts` | `createCamera`, `setCameraTarget`, `tickCamera`, `worldToScreen`, `isInView`, `Camera` |
| `scene.ts` | `createSceneManager`, `pushScene`, `popScene`, `replaceScene`, `currentScene`, `updateScenes`, `renderScenes`, `Scene` |
| `save.ts` | `createSaveProfile`, `writeSave`, `writeSaveThrottled`, `readSave`, `readSaveLatest`, `saveExists`, `deleteSave`, `listSaves`, `SaveProfile`, `SaveProfileConfig`, `SaveResult`, `LoadResult`, `SlotInfo` |
| `hiscore.ts` | `createHighScores`, `loadHighScores`, `isHighScore`, `insertScore`, `clearHighScores`, `HighScoreEntry`, `HighScoreConfig`, `HighScores`, `InsertResult` — high-score table over the save envelope |
| `tilemap.ts` | `createTileMap`, `setTile`, `getTile`, `clearTile`, `fill`, `fillRect`, `isSolid`, `findById`, `render`, `setBackground`, `Tile`, `Viewport`, `TileMap` |
| `tilescroll.ts` | `drawTileMapAt`, `tileMapWorldSize` (pixel-smooth sub-tile scrolling) |
| `ui.ts` | `drawBox`, `drawFrame`, `drawPanelTitle`, `drawDottedGrid`, `drawSegmentedBar`, `drawTank`, `drawDial`, `drawCompassText`, `drawProgressBar`, `tickUI`, `renderUI`, `resetUI`, `BorderOptions`, `DrawProgressBarOptions` |
| `i18n.ts` | `pickLocale` |
| `cache.ts` | `createLayerCache`, `invalidateLayer`, `refreshLayer`, `LayerCache` |
| `attrscreen.ts` | `createAttrScreen`, `clearAttrScreen`, `stampMono`, `flushAttrScreen`, `AttrScreen`, `AttrPolicy` |
| `monoscreen.ts` | `createMonoScreen`, `clearMonoScreen`, `drawMonoBitmap`, `fillMono`, `flushMonoScreen`, `MonoScreen` |
| `lighting.ts` | `ditherBlack`, `brightnessAt`, `createDarknessLayer`, `renderDarkness`, `Light`, `DarknessLayer` |
| `glow.ts` | `createGlowLayer`, `renderGlow`, `drawGlowSource`, `glowBufferSize`, `GlowLayer`, `GlowOptions`, `GlowSource` — opt-in additive bloom (the additive twin of `lighting`) |
| `music.ts` | `noteToFreq`, `seq`, `playAYLoop`, `SeqOptions`, `LoopHandle` |
| `presentation.ts` | `blinkVisible`, `drawBlinkingText`, `drawTapeStripes`, `drawMenuOptions`, `TapeStripesOptions`, `MenuOptionsConfig` |
| `debug.ts` | `createDebugMonitor`, `beginFrame`, `endFrame`, `sampleDebug`, `drawDebugOverlay`, `DebugInfo`, `DebugMonitor` |

**API stability:** module Stable/Experimental classification, deprecation policy, and the road to 1.0 live in `docs/api-stability.md`. Experimental today: `music`, `presentation`, `lighting` — everything else is Stable. Only the root export is public (no subpaths); `_`-prefixed / non-barrel symbols are internal.

**Planned hardening:** dev-only `console.warn` validation for enum-like value-set args (colour/`SpectrumColor`, `Direction`, `AYChannel`, `AttrPolicy`, `DITHER` pattern…) so a typo like `C.B_ZELLOW` isn't a silent wrong render. Survey + plan: `docs/dev-validation.md`. **Not started** — scheduled after The Strip / Minefield v1.0.

## Architecture constraints

- **No runtime dependencies** — only browser platform APIs (`Canvas`, `Web Audio`, `KeyboardEvent`, `Gamepad`).
- **Singleton state** — `audio.ts`, `ay.ts`, and `input.ts` hold module-level state. Not suitable for multiple game instances on the same page.
- **ZX Spectrum authenticity** — palette values in `palette.ts`, font bytes in `font.ts`, and `CELL=8` are constants, not configuration. Do not alter them.
- **`SpectrumColor` type** is `typeof C[keyof typeof C]` — the hex value union. All `ink`/`paper` params must use this type, not plain `string`.
- **`sideEffects: false`** — no DOM access, listeners, or network calls at import time. Unused modules are fully tree-shaken.

## Input module — gamepad

Gamepad support is built into `input.ts` and is **fully transparent** — no new init call required. `tickMovement(dt)` polls `navigator.getGamepads()` each frame and synthesizes events into the same repeat state machine used by the keyboard.

**Mapping (standard gamepad layout):**

| Gamepad | Action |
|---------|--------|
| D-pad / left stick | Directional movement (dominant axis, 0.35 deadzone) |
| A / Cross (button 0) | `consumeFlag()` |
| Start / Options (button 9) | `consumePause()` |
| Y / Triangle (button 3) | `consumeDebug()` |
| Any button | `consumeAnyKey()` |

D-pad takes priority over stick. Keyboard and gamepad coexist — keyboard wins if both provide a direction simultaneously.

## Testing

Test files live in `tests/` (`*.tests.ts`). Run with `npm test`; `npm run test:coverage` adds V8 coverage and enforces the 75% thresholds from `vitest.config.ts`. Tests use `jsdom` for DOM globals.

## Release pipeline

Semantic-release on push to `main`. Commit message format: `feat:`, `fix:`, `chore:` etc. The workflow (`.github/workflows/release.yml`) runs on **every** push to `main`: build → tests with coverage (75% thresholds) → `npm pack --dry-run` → semantic-release, which bumps the version, updates CHANGELOG.md, and publishes to npm only when a releasable commit type landed. Avoid `word#word` / `word/word` patterns in commit messages — the release-notes generator linkifies them as bogus issue references (this once turned "hi/score" into a broken `closes hi#score` link in the changelog).
