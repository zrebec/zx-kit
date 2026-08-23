# AGENTS.md

Guidance for AI agents (Codex, Claude Code, and anything else) working in this repository.

**This file is the single source of truth.** `CLAUDE.md` does nothing but import it
(`@AGENTS.md`) and add Claude-Code-specific harness notes. Project knowledge —status,
module map, constraints, workflow — belongs **here**, never in `CLAUDE.md`. When something
changes, update this file; the other one follows for free.

## Project snapshot

`zx-kit` is a zero-runtime-dependency TypeScript library for building browser games that
look and sound like a ZX Spectrum without inheriting the original hardware limits. It ships
compiled JavaScript and declarations from `dist/` and is consumed straight from npm — no
Vite aliases, no path mapping.

| | |
|---|---|
| Package version | `0.44.0` (published to npm by semantic-release) |
| Node engine | `>=22` (CI runs Node 24; `.nvmrc` records it) |
| Module format | ESM (`"type": "module"`) |
| Runtime dependencies | **none** |
| Dev tooling | TypeScript, Vitest (+ `@vitest/coverage-v8`), semantic-release |
| Public API | the barrel `src/index.ts` → `./dist/index.js` |
| Published files | `dist/`, `README.md`, `LICENSE` (tests are **not** shipped) |
| Test baseline | **30 test files / 1100 tests**, ~97% lines, ~98% functions |

The **root export is the only public entry point.** Subpath exports are deliberately not
exposed and are not needed — everything (including `cache`, `attrscreen`, `monoscreen`,
`glow`, `music`, `presentation`) comes out of `./dist/index.js`.

## Current status and roadmap

The library is **feature-complete for its scope**. Remaining work is docs/packaging hygiene
and public-API stabilisation toward 1.0 — *not* engine surface.

- **Done:** GLOW (the last sanctioned new module, see below); tests removed from `dist`;
  `.gitattributes` locks line endings to LF; the README split — the former ~3k-line README
  is now a short landing page plus `docs/{getting-started,rendering,audio,collision,save,api,examples}.md`.
- **Next:** public-API stabilisation — Stable/Experimental classification and a deprecation
  policy (`docs/api-stability.md`), then 1.0.
- **Dropped:** a flagship "kitchen-sink" demo and a GitHub Pages landing page. The games
  *are* the demo.

Historical context: the retrospective written after v0.16.0 (the save system) —
`docs/retrospective.md` (English, committed) and `docs/retrospective.sk.md` (Slovak,
gitignored). Read it before proposing new modules or large refactors. The live task list
lives outside this repo in `retro/docs/portfolio/tasks_all_projects.md` (K-items), with the
consolidated Slovak working doc at `retro/docs/sk/zx-kit.md`.

### Flagship consumers

Two games carry the whole kit and *are* its demo:

- **chaosBunny** (`/Users/zrebec/Projects/retro/games/chaosbunny`) cycles four playfield
  looks (fantasy bricks/black → mono anti-clash → authentic attribute clash) through a small
  `Painter` adapter — the proof that the rendering core holds together.
- **Minefield** (`/Users/zrebec/Projects/retro/games/minefield`) is the reference
  integration for new primitives (`save`, `rng` daily seed, `presentation`, glow radar/sonar)
  and the first consumer for anything new.

## Scope boundaries

Do **not** add these unless the user explicitly changes the roadmap:

- `physics.ts`
- `particle.ts` (note: the existing `particles.ts` is a different, shipped module)
- networking
- multiplayer

The philosophy is Spectrum-style restraint: small primitives, clear composition, no
framework sprawl until a real game proves the need. Prefer module-local helpers over new
public exports. New modules are acceptable **only** when the owner green-lights them — and
then only if each ships with its own tests at the standard below.

## Testing discipline

The standing bar, and it is currently **met**:

- Every module ships with its own `tests/<module>.tests.ts`.
- Every exported function and type has at least one test.
- Coverage stays at **≥ 75%** on lines, functions, branches and statements — enforced by
  `vitest.config.ts` thresholds and gated on every release by `npm run test:coverage` in CI.
  Actual coverage sits ~97%; the threshold guards the promise, not the high-water mark.

If this regresses, restore tests before feature work. The only work that may skip
tests-first is fixing a bug that is actively breaking something. **Do not lower coverage and
do not add public API without tests.**

### How the tests run

- Test files: `tests/*.tests.ts` (config also picks up `*.test.ts` anywhere).
- Environment is **`node`**, not jsdom — DOM, Canvas 2D and Web Audio are hand-mocked with
  fake contexts in each test file. Copy the existing mocks in `renderer.tests.ts` /
  `attrscreen.tests.ts` rather than reaching for a DOM implementation.
- Rendering modules must stay **headless-safe**: no `document` → offscreen canvases are
  `null`, the pure maths still runs and is tested, the blit is skipped. `attrscreen.ts`,
  `lighting.ts` and `glow.ts` are the pattern to mirror.
- Coverage-sensitive areas: renderer and bitmap/attribute rendering, collision (especially
  pixel-perfect ground truth), input singleton state and gamepad polling, save/load failure
  modes and throttling, audio/AY browser-API mocks.
- Cross-module behaviour goes into an integration suite — see `bitmap-integration.tests.ts`.
- **Tests must contain nothing third-party and add zero dependencies** (dev or runtime).
  Generate fixtures in memory (e.g. a synthesised PSG dump); never commit real tunes or
  assets, and never add a package just to support a fixture.

Run focused tests while changing one module, then the full suite before finishing if the
change touches public API, shared helpers, rendering, collision, save/load, input, audio or
documentation examples.

### What the tests cannot cover

Green tests mean the maths holds — not that the result looks or sounds right. No coding
agent can check either of these, so never claim them:

- **Audio cannot be heard.** Beeper, AY and PSG output are verified by the owner's ear and
  nothing else. Ship the code and the tests, and say plainly that the *sound* is untested.
- **Rendering cannot be seen.** There is no browser in an agent session. Visuals are
  confirmed through headless tests plus the two consumer games.

## Build and verification

```bash
npm run build          # tsc → dist/
npm test               # vitest run (fast, no coverage)
npm run test:coverage  # vitest run --coverage — enforces the 75% thresholds (used by CI)
```

`tsconfig.json` emits to `dist/` with `declaration`, `declarationMap` and `sourceMap` on.

## Architecture constraints

- **No runtime dependencies** — only browser platform APIs (`Canvas`, `Web Audio`,
  `KeyboardEvent`, `Gamepad`).
- **No import-time side effects** — `sideEffects: false` must stay true: no DOM access,
  listeners or network calls at import time, so unused modules tree-shake completely.
- **Singleton state is intentional** in `audio.ts`, `ay.ts` and `input.ts`. They are designed
  for one game instance per page and are not suitable for several.
- **ZX Spectrum authenticity constants** — palette values in `palette.ts`, font bytes in
  `font.ts` and `CELL = 8` are constants, not configuration. Do not alter them.
- **`SpectrumColor`** is `typeof C[keyof typeof C]`, the hex value union. All `ink`/`paper`
  parameters use this type; never weaken it to `string`.
- **Functional, small APIs** — the style is `createX(...)` plus standalone operations, not
  classes with methods. (`AYChipCore`/`AYDumpPlayer` in `aydump.ts` are the deliberate
  exception: a register-level chip emulator is genuinely stateful.)

## Module map

Every module is re-exported through the barrel `src/index.ts`.

| Module | Key exports |
|--------|-------------|
| `palette.ts` | `SCALE=4`, `CELL=8`, `C` (15-colour object), `SpectrumColor` |
| `font.ts` | `FONT` (96-char ROM bitmap), `getCharRow` |
| `renderer.ts` | `setupCanvas`, `curveDisplay`, `mirrorSprite`, `drawSprite`, `drawChar`, `drawText`, `drawTextCentered`, `drawScanlines`, `drawShade`, `DITHER`, `createBitmap`, `createBitmapFromRows`, `drawBitmap`, `mirrorBitmap`, `createAttrMap`, `drawBitmapAttrs`, `mirrorAttrMap`, `flashBorder`, `Bitmap`, `AttrMap` |
| `audio.ts` | `initAudio`, `resumeAudio`, `beep`, `stopBeep`, `playPattern`, `getAudioContext`, `getMasterGain`, `getMasterVolume`, `setMasterVolume`, `increaseVolume`, `decreaseVolume`, `setVolumeBarStyle`, `drawVolumeBar`, `Note`, `BeeperPatternHandle`, `VolumeBarStyleOptions` |
| `ay.ts` | `createAY`, `playAY` (authored `gains`/`stereo` mix), `AY_CLOCK`, `AY_VOL`, `AY_ENVELOPE_SHAPES`, `AYChannel`, `AYChannelGains`, `AYNote` (incl. `pan`/`panTo`), `AYChip`, `AYHandle` (live gain/pan/stereo/stop), `AYStereoMode` |
| `aydump.ts` | `parsePSG`, `loadPSG`, `playAYDump`, `renderAYDump`, `AYChipCore`, `AYDumpPlayer`, `AY_MACHINE`, `AYDump`, `AYDumpHandle`, `AYChipConfig`, `AYChipVariant` — one sample-accurate AudioWorklet chip core with post-register A/B/C gains (reuses `ay.ts` constants/types + `audio.ts` master gain) |
| `input.ts` | `initInput`, `tickMovement`, `consumeFlag`, `consumeDebug`, `consumePause`, `consumeAnyKey`, `isHeld`, `resetInput`, `setVolumeKeys`, `Direction` |
| `sprite.ts` | `createSprite`, `moveSprite`, `applyGravity`, `renderSprite`, `Sprite` |
| `collision.ts` | `spriteRect`, `bitmapRect`, `rectsOverlap`, `spritesOverlap`, `isSolidAt`, `resolveRectX`, `resolveRectY`, `resolveX`, `resolveY`, `bitmapPixelMask`, `masksOverlap`, `pixelSolidCount`, `Rect`, `PixelMask` |
| `particles.ts` | `createParticleSystem`, `emitParticles`, `tickParticles`, `renderParticles`, `clearParticles`, `Particle`, `ParticleSystem`, `EmitOptions`, `Ranged` |
| `rng.ts` | `createRng`, `hashSeed`, `Rng` (seeded mulberry32: `next`/`int`/`range`/`float`/`chance`/`pick`/`shuffle`/`shuffleCopy`/`fork`) |
| `animation.ts` | `createAnimation`, `tickAnimation`, `getAnimationFrame`, `resetAnimation`, `createTween`, `tickTween`, `createBlinker`, `tickBlinker`, `Easings`, `Easing`, `Animation`, `Tween`, `Blinker` |
| `camera.ts` | `createCamera`, `setCameraTarget`, `tickCamera`, `worldToScreen`, `isInView`, `Camera`, `CameraOptions` |
| `scene.ts` | `createSceneManager`, `pushScene`, `popScene`, `replaceScene`, `currentScene`, `updateScenes`, `renderScenes`, `Scene`, `SceneManager` |
| `save.ts` | `createSaveProfile`, `writeSave`, `writeSaveThrottled`, `readSave`, `readSaveLatest`, `saveExists`, `deleteSave`, `listSaves`, `SaveProfile`, `SaveProfileConfig`, `SaveResult`, `LoadResult`, `SlotInfo` |
| `hiscore.ts` | `createHighScores`, `loadHighScores`, `isHighScore`, `insertScore`, `clearHighScores`, `HighScoreEntry`, `HighScoreConfig`, `HighScores`, `InsertResult` — high-score table over the save envelope |
| `tilemap.ts` | `createTileMap` (+ its `setTile`/`getTile`/`clearTile`/`fill`/`fillRect`/`isSolid`/`findById`/`render`/`setBackground` operations), `Tile`, `Viewport`, `TileMap` |
| `tilescroll.ts` | `drawTileMapAt`, `tileMapWorldSize` (pixel-smooth sub-tile scrolling) |
| `ui.ts` | `drawBox`, `drawFrame`, `drawPanelTitle`, `drawDottedGrid`, `drawSegmentedBar`, `drawTank`, `drawDial`, `drawCompassText`, `drawProgressBar`, `tickUI`, `renderUI`, `resetUI`, `BorderOptions`, `DrawProgressBarOptions` (+ per-widget option types) |
| `i18n.ts` | `pickLocale` |
| `cache.ts` | `createLayerCache`, `invalidateLayer`, `refreshLayer`, `LayerCache` |
| `attrscreen.ts` | `createAttrScreen`, `clearAttrScreen`, `stampMono` (opt-in `glow`), `flushAttrScreen`, `drawAttrGlowSources`, `AttrScreen` (incl. `cellGlow`), `AttrPolicy` |
| `monoscreen.ts` | `createMonoScreen`, `clearMonoScreen`, `drawMonoBitmap`, `fillMono`, `flushMonoScreen`, `MonoScreen` |
| `lighting.ts` | `ditherBlack`, `brightnessAt`, `createDarknessLayer`, `renderDarkness`, `Light`, `DarknessLayer` |
| `glow.ts` | `createGlowLayer`, `renderGlow`, `drawGlowSource`, `glowBufferSize`, `GlowLayer`, `GlowOptions`, `GlowSource` — opt-in additive bloom (the additive twin of `lighting`) |
| `music.ts` | `noteToFreq`, `seq`, `playAYLoop`, `SeqOptions`, `LoopHandle` (mixer that survives the loop seam) |
| `presentation.ts` | `blinkVisible`, `drawBlinkingText`, `drawTapeStripes`, `drawMenuOptions`, `TapeStripesOptions`, `MenuOptionsConfig` |
| `debug.ts` | `createDebugMonitor`, `beginFrame`, `endFrame`, `sampleDebug`, `drawDebugOverlay`, `DebugInfo`, `DebugMonitor` |

**API stability:** Stable/Experimental classification, the deprecation policy and the road to
1.0 live in `docs/api-stability.md`. Experimental today: `music`, `presentation`, `lighting`
— everything else is Stable. Only the root export is public; `_`-prefixed and non-barrel
symbols (e.g. `_envelopeSig`, `_buildAYDumpWorkletSource`) are internal.

**Planned hardening (not started):** dev-only `console.warn` validation for enum-like
value-set arguments (`SpectrumColor`, `Direction`, `AYChannel`, `AttrPolicy`, `DITHER`
patterns…) so a typo like `C.B_ZELLOW` is not a silent wrong render. Survey and plan in
`docs/dev-validation.md`; scheduled after Minefield v1.0.

## Module notes

### Renderer

Two sprite tiers: classic 8×8 `Uint8Array` sprites (`drawSprite`, `mirrorSprite`) and
arbitrary-size `Bitmap` sprites (`createBitmap`, `drawBitmap`, `mirrorBitmap`). `AttrMap`
adds authentic per-8×8-cell ink/paper attributes for larger bitmaps — the Spectrum
colour-clash model, and it should stay explicit. Keep rendering functions deterministic and
allocation-conscious. Image smoothing is **off** everywhere except the one blur draw inside
`glow.ts`, which restores it. Deeper notes: `docs/rendering.md`.

### Collision

Three tiers — AABB (`rectsOverlap`, `spritesOverlap`, `spriteRect`, `bitmapRect`),
rect-vs-tile (`resolveRectX/Y`, `resolveX/Y`, `isSolidAt`), and pixel-precise
(`bitmapPixelMask`, `masksOverlap`, `pixelSolidCount`). Pixel masks are meant to be
precomputed once and reused every frame. Overlap functions return **counts, not booleans**,
so games can apply thresholds, damage scaling or contact fractions. Read `docs/collision.md`
before changing collision semantics.

### Input

Keyboard and gamepad share one movement/consume API. Gamepad support is **fully
transparent** — no extra init call; `tickMovement(dt)` polls `navigator.getGamepads()` each
frame and synthesises events into the same repeat state machine as the keyboard.

| Input | Action |
|-------|--------|
| Arrow keys / WASD, D-pad / left stick | Movement (dominant axis, 0.35 deadzone) |
| `F` / gamepad button 0 (A / Cross) | `consumeFlag()` |
| `P` / gamepad button 9 (Start / Options) | `consumePause()` |
| `Ctrl+Shift+B` / gamepad button 3 (Y / Triangle) | `consumeDebug()` |
| `+` `=` / `-` `_` | `increaseVolume()` / `decreaseVolume()` |
| Any key / any gamepad button | `consumeAnyKey()` |

D-pad takes priority over the stick; keyboard wins if both give a direction in the same
frame. `resetInput()` clears held state and pending consume flags — be careful with it
around phase transitions and gamepad edge cases.

### Audio

Three layers, all routed through the same master gain:

- `audio.ts` — 1-bit-style beeper for SFX and simple monophonic patterns; every
  `playPattern` call has an isolated gain/stop handle while `stopBeep` remains global.
- `ay.ts` — AY-3-8912-style three-channel synthesis for music, envelopes and noise. Its
  sequencer exposes post-note A/B/C gains and authored/live pan without rewriting envelopes.
- `aydump.ts` — the sample-accurate path: a PSG register-dump player running one AudioWorklet
  chip core. Per-channel gains live after register synthesis, so mute/solo never reset chip state.

MUTE and SOLO are consumer policy, not chip state: implement them by composing the channel
gain primitives. Do not add a second chip core, mask volume registers, or duplicate AY synthesis
in a consumer merely to isolate channels.

**Author the mix, do not correct it.** Anything that calls `playAY()` repeatedly — `playAYLoop`
above all — must pass `gains`/`stereo` in the pattern so a strip is *born* at its level. Calling
`setChannelGain()` after the fact ramps down from unity, which leaks an audible frame on a muted
channel at every loop boundary. The live setters are for changes a human makes mid-playback.

`playAY()` releases its mixer strips on the last voice's `onended`, never inside `stop()` —
disconnecting there would cut the anti-click fade `stop()` just scheduled.

Browser autoplay policy applies: audio initialisation must happen inside a user gesture.

**Volume control (shipped in 0.34.0):** `initInput` maps `+`/`-` by default (remap with
`setVolumeKeys(up, down)`, disable with `setVolumeKeys([], [])`), and the auto-hide HUD bar
is `setVolumeBarStyle(opts)` once plus `drawVolumeBar(ctx)` in the render loop (visible ~1.5 s
after a change, then hides). This is a **deliberate break from ZX authenticity** — the Speccy
had no software volume — in the same "under glass, 2026" family as `curveDisplay` and
scanlines. Minefield has adopted it; **chaosBunny adoption is still pending**.

### Lighting and glow

A subtractive/additive pair around the same light positions. Render order in the game loop:
scene (flat palette) → `renderDarkness` (dims everything not lit) → `renderGlow` (blooms the
sources) → `drawScanlines` → `curveDisplay` (CSS).

`glow.ts` is the kit's one sanctioned late addition (owner-approved; core + callback feed
shipped in 0.39.0, the attribute bit in 0.40.0). The design, in short:

- **Emissive, not a palette entry.** A glow marker in the spirit of the FLASH attribute bit:
  a pixel keeps its exact 15-palette colour and is merely flagged emissive. Overlapping
  haloes sum into *perceived* extra colours **on the glass only** — the framebuffer palette
  stays flat and untouched. Making glow a lighter flat colour was explicitly **rejected**: it
  would dilute the palette to ~22–30 colours (an Amstrad look).
- **Only light *sources* glow** — torch, moon, crystal, sonar blip, radar sweep — never the
  things they light.
- **Bloom = downscale → upscale → additive blend**, 2–3 `drawImage` calls on offscreen
  canvases, no WebGL. The upscale runs with `imageSmoothingEnabled = true` (the browser's
  bilinear filter *is* the blur, for free) and restores it afterwards; the composite uses
  `globalCompositeOperation = 'lighter'` at a low `globalAlpha`. High alpha washes the core
  toward white — keep it low and eye-tune.
- Bloom takes the **source's own colour** (a red radar blooms red), intensity is scaled
  per-source via `GlowSource.intensity` (like `Light`).
- Two feeds exist, both opt-in: a `drawSources` callback / `GlowSource[]` list (works for
  direct-draw games), and the `cellGlow` attribute plane on `AttrScreen`
  (`stampMono(..., glow)` + `drawAttrGlowSources`) for clash-mode games. `glow` defaults to
  `false`, so untouched games render byte-for-byte identically. A third option — a per-cell
  glow flag in `AttrMap`/`drawBitmapAttrs` — is deferred until a game needs it.
- **Do not fold bloom, scanlines and vignette into a unified `crt.ts`.** Glow stays a
  standalone composable; bundling is a separate, later call.

### Save and high scores

`save.ts` owns storage infrastructure only: localStorage namespace, version envelope, error
mapping, slot enumeration, throttling and Result types. The **game** owns state shape through
`serialize`/`deserialize`. Do not turn save/load into a general object-graph snapshot system
— it would silently corrupt Sets, Maps, class instances, circular references and runtime
handles. `hiscore.ts` is a high-score table layered on the same envelope. See `docs/save.md`.

### i18n

`pickLocale(defaultLocale, locales, code)` picks a locale object at runtime with fallback to
the default, generic over the locale object shape — so translation packs with missing keys or
wrong function signatures fail at compile time. `null`/`undefined`/empty and unknown codes
return the default; matching is case-insensitive; the default locale need not appear in the
map. This enables runtime language switching, a deliberate modern comfort over Spectrum-style
presentation.

## Documentation

`README.md` is the landing page; the depth lives in `docs/`: `getting-started`, `rendering`,
`audio`, `collision`, `save`, `api`, `examples`, plus `api-stability`, `known-issues` and
`dev-validation`. Keep examples compilable and consistent with the current exports. English
docs are committed; some Slovak docs are gitignored.

When adding a public export, update in the same change:

1. `src/index.ts` (the barrel),
2. tests for that export,
3. the module map in this file and `docs/api-stability.md`,
4. `README.md` and the relevant `docs/*.md`.

## Release pipeline

Semantic-release runs on **every** push to `main` via `.github/workflows/release.yml`:
build → tests with coverage (75% thresholds) → `npm pack --dry-run` → semantic-release, which
bumps the version, updates `CHANGELOG.md` and publishes to npm only when a releasable commit
type landed.

Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`, `perf:`.

- Do not hand-edit `CHANGELOG.md` or bump the version manually.
- Avoid `word#word` / `word/word` patterns in commit messages — the release-notes generator
  linkifies them into bogus issue references (this once turned "hi/score" into a broken
  `closes hi#score` link).
- Writing the changelog and version back to protected `main` depends on a `RELEASE_TOKEN`
  PAT secret plus a main-ruleset bypass configured in the GitHub UI (not in the repo). If
  releases stop updating the changelog, check that first.
