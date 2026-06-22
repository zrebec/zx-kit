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
(currently ~96%). This bar is **met** — new modules are fine **provided each ships with
its own tests** at the same standard. The only work that may skip tests-first is fixing
a bug that is actively breaking something.

**Do not add** `physics.ts`, `particle.ts`, network, or multiplayer modules. Spectrum
philosophy: less is more.

## Current status

`zx-kit` **0.32.x** is a published npm package (semantic-release on push to `main`) — **26 test files / ~917 tests, ~96% line coverage**. It ships compiled JS + `.d.ts` from `dist/` and exports **everything** — including `cache`, `attrscreen`, `monoscreen`, `music`, `presentation` — from `./dist/index.js` (root export only; subpaths are not exposed, and don't need to be). No Vite aliases or path hacks.

Flagship consumers — the two games that carry the whole kit and **are** its demo (there is no separate showcase build): **chaosBunny** (`/Users/zrebec/Projects/chaosbunny`, on `^0.32.0`) cycles four playfield looks (fantasy bricks/black → mono anti-clash → authentic attr clash) through a small `Painter` adapter — the proof the rendering core holds together; **Minefield** is the reference integration for new primitives (`save`, `rng` daily seed, `presentation`) and the first consumer for anything new.

**Next: stabilisation, not new modules.** The library is feature-complete for its scope; the remaining work is docs/packaging hygiene and public-API stabilisation toward 1.0 — not engine surface. Done already: tests no longer ship in `dist`; `.gitattributes` locks line endings to LF; and the **README split (K4) is complete** — the former ~3k-line README is now a 271-line landing page plus `docs/{getting-started,rendering,audio,collision,save,api,examples}.md`. Next up: public-API stabilisation (stable/experimental classification, deprecation policy) toward 1.0. **No flagship "kitchen-sink" demo or GitHub Pages landing — that idea (K5) is dropped; Minefield and chaosBunny are the demo.** See `retro/docs/portfolio/tasks_all_projects.md` (K-items) for the live list, and `retro/docs/sk/zx-kit.md` for the consolidated SK working doc.

## Planned (next feature): built-in volume control — `+`/`-` keys + auto-hide HUD bar

**Goal (owner, 2026-06-21):** make per-game volume control *almost free*. Today the volume **logic**
already lives here (`audio.ts`: `increaseVolume`/`decreaseVolume`/`getMasterVolume`/`setMasterVolume`),
but every game re-implements the `+`/`-` key mapping and the HUD bar (Minefield does this by hand).
Move both into zx-kit so a game gets volume with ~1 line. **This will be a `feat:` → 0.34.0**; first
consumers **Minefield** then **chaosBunny** (the driver for new zx-kit features). Owner is fine with
zx-kit owning `+`/`-` by default (browsers reserve keys too), and wants the keys **remappable** with
`+`/`-` as the default when a game supplies no custom set. `increaseVolume()`/`decreaseVolume()` **must
stay parameter-less** (no-arg methods) — the new code calls them, it does not change their signature.

### What already exists (reuse, don't rebuild)
- `audio.ts`: `increaseVolume()`, `decreaseVolume()` (no-arg, step `VOLUME_STEP = 0.1`), `getMasterVolume()`, `setMasterVolume(v)`.
- `ui.ts`: `drawProgressBar(ctx, opts)` is a **managed widget with auto-hide** via `opts.visibilityLength`
  (ms) + `tickUI`/`renderUI`/`resetUI`. Its JSDoc already shows a volume-bar example. The new HUD helper
  is a thin wrapper over this — do **not** write a new bar renderer.

### Exact steps
1. **`audio.ts` — auto-show timestamp.** Add a module-level `let _volumeChangedAt = 0`. In
   `increaseVolume()` and `decreaseVolume()` (still no-arg), after changing volume set
   `_volumeChangedAt = performance.now()`. Export `_volumeChangedAt` via a getter or keep it internal and
   read it from the bar helper (same module). This is the "the methods themselves trigger the render" the
   owner asked for — calling them (by key OR programmatically) makes the bar show.
2. **Config-once style + clean per-frame draw (owner's API shape, 2026-06-21).** Defaults are
   pre-wired; a game customises once, then the loop call takes no style args. Naming follows the kit
   convention — `set*` for configuration (like `setMasterVolume`), `draw*` for rendering.
   - **`setVolumeBarStyle(opts?: { color?: SpectrumColor; segments?: number; x?: number; y?: number })`** —
     stores style in module state (NO `ctx`, NO rendering here). Optional; the defaults below apply if it
     is never called. `segments` = bar width in cells (`width = segments * CELL`). **Options object**, not
     positional args, so it extends without breaking (border/paper/etc. later).
   - **`drawVolumeBar(ctx)`** — the only loop call, **no style args** (reads the stored style). Auto-show:
     if `performance.now() - _volumeChangedAt > VOLUME_BAR_MS` (new const, default `1500`) → draw nothing;
     else → `drawProgressBar` with stored style + `value: getMasterVolume()`. Centre via `ctx.canvas`
     width if `x` is unset. (zx-kit can't render without a ctx, so this one render-loop line is the
     irreducible minimum — keep it to exactly that.)
3. **Volume keys — default on, remappable via a dedicated setter (owner's shape).**
   - `initInput` (today `(repeatDelay = 150, repeatInterval = 80)`) enables `+`/`-` **by default** in its
     `keydown` listener: up-set → `increaseVolume()`, down-set → `decreaseVolume()`. Defaults up
     `['+', '=']`, down `['-', '_']`. (zx-kit owning `+`/`-` is the owner-approved trade-off.)
   - **`setVolumeKeys(up: string | string[], down: string | string[])`** — optional override (e.g.
     `setVolumeKeys('9', '8')`); not mandatory, `+`/`-` stays if never called. **Disable** with empty
     sets: `setVolumeKeys([], [])`.
   - `input.ts` calling `audio.ts` is a new intra-kit dependency — fine (like `renderer`→`palette`).
4. **`index.ts`** — export `setVolumeBarStyle`, `drawVolumeBar`, `setVolumeKeys` (+ any new types) from the barrel.
5. **Tests** (`*.tests.ts`, keep ≥ 75% line coverage): `increaseVolume`/`decreaseVolume` move
   `_volumeChangedAt`; `drawVolumeBar` draws only within the window (use the `makeMockCtx` fill-recording
   pattern from `tests/renderer.tests.ts`) and honours `setVolumeBarStyle`; `setVolumeKeys` default /
   custom / disabled-via-empty-sets paths.
6. **Docs:** add `setVolumeBarStyle` / `drawVolumeBar` / `setVolumeKeys` to the `audio` (and `input`)
   rows in the Module map + `docs/audio.md`; note in `docs/api-stability.md` (Experimental at first).
   Record that this is a **deliberate break from ZX authenticity** (Speccy had no SW volume) — an
   "under glass, 2026" affordance like `curveDisplay`/scanlines.

### Exact defaults (the bar Minefield already draws — copy these values)
From Minefield's `volBar()`: a centred, 10-segment green bar, solid border, auto-hide 1.5 s. These are
the `setVolumeBarStyle` defaults when the game doesn't override them:
```ts
segments: 10                            // → width = 10 * CELL = 80 px
x:        centred via ctx.canvas width  // override with setVolumeBarStyle({ x })
y:        96 - CELL                      // roughly mid-screen (tune); or near the bottom
color:    C.B_GREEN                      // → drawProgressBar ink
// fixed internally: value = getMasterVolume() (min 0, max 1), paper C.BLACK,
// border { style: 'solid' }, visibilityLength 1500
```

### Game-side result (the payoff — verify after)
Default case = volume in **one render-loop line**, keys free; customisation is one optional `set*` call:
```ts
initInput()                              // +/- controls volume (default on)
setVolumeBarStyle({ color: C.B_CYAN })   // optional — defaults are fine without it
setVolumeKeys('9', '8')                  // optional — +/- stays if you skip it
// in the render loop:
drawVolumeBar(ctx)                       // shows ~1.5 s after a change, then hides itself
```
Then **delete the per-game volume code**: in Minefield that's `pendingVolUp/Down` +
`consumeVolUp/consumeVolDown` (`input.ts`), the `volBar()` object + the `drawProgressBar` volume calls
(`main.ts`). That deletion is the win the owner wants to see.

### Rollout
`feat(audio): built-in volume keys + auto-hide HUD bar` → semantic-release cuts **0.34.0** → Dependabot
opens bump PRs → **Minefield** adopts first (delete its volume code), then **chaosBunny**.

## Build

```bash
npm run build       # tsc → dist/
npm test            # vitest run
npm version patch   # bump version (triggers semantic-release on push)
```

`tsconfig.json` emits to `dist/` with `declaration: true`, `declarationMap: true`, `sourceMap: true`.

## Module map

All modules re-exported through the barrel `src/index.ts`:

| Module | Key exports |
|--------|-------------|
| `palette.ts` | `SCALE=4`, `CELL=8`, `C` (15-color object), `SpectrumColor` type |
| `font.ts` | `FONT` (96-char ROM bitmap), `getCharRow()` |
| `renderer.ts` | `setupCanvas`, `curveDisplay`, `mirrorSprite`, `drawSprite`, `drawChar`, `drawText`, `drawTextCentered`, `drawScanlines`, `createBitmap`, `drawBitmap`, `mirrorBitmap`, `createAttrMap`, `drawBitmapAttrs`, `mirrorAttrMap`, `flashBorder` |
| `audio.ts` | `initAudio`, `resumeAudio`, `beep`, `playPattern`, `getAudioContext`, `getMasterGain`, `getMasterVolume`, `setMasterVolume`, `increaseVolume`, `decreaseVolume`, `setVolumeBarStyle`, `drawVolumeBar`, `VolumeBarStyleOptions` |
| `ay.ts` | `createAY`, `playAY`, `AY_CLOCK`, `AY_VOL`, `AY_ENVELOPE_SHAPES`, `AYChannel`, `AYNote`, `AYChip`, `AYHandle` |
| `input.ts` | `initInput`, `tickMovement`, `consumeFlag`, `consumeDebug`, `consumePause`, `consumeAnyKey`, `isHeld`, `resetInput`, `setVolumeKeys`, `Direction` |
| `sprite.ts` | `createSprite`, `moveSprite`, `applyGravity`, `renderSprite`, `Sprite` |
| `collision.ts` | `spriteRect`, `bitmapRect`, `rectsOverlap`, `spritesOverlap`, `isSolidAt`, `resolveRectX`, `resolveRectY`, `resolveX`, `resolveY`, `Rect`, `bitmapPixelMask`, `masksOverlap`, `pixelSolidCount`, `PixelMask` |
| `animation.ts` | `createAnimation`, `tickAnimation`, `getAnimationFrame`, `resetAnimation`, `createTween`, `tickTween`, `createBlinker`, `tickBlinker`, `Animation`, `Tween`, `Blinker`, `Easings` |
| `camera.ts` | `createCamera`, `setCameraTarget`, `tickCamera`, `worldToScreen`, `isInView`, `Camera` |
| `scene.ts` | `createSceneManager`, `pushScene`, `popScene`, `replaceScene`, `currentScene`, `updateScenes`, `renderScenes`, `Scene` |
| `tilemap.ts` | `createTileMap`, `setTile`, `getTile`, `clearTile`, `fill`, `fillRect`, `isSolid`, `findById`, `render`, `setBackground`, `Tile`, `Viewport`, `TileMap` |
| `ui.ts` | `drawBox`, `drawFrame`, `drawPanelTitle`, `drawDottedGrid`, `drawSegmentedBar`, `drawTank`, `drawDial`, `drawCompassText`, `drawProgressBar`, `tickUI`, `renderUI`, `resetUI`, `BorderOptions`, `DrawProgressBarOptions` |
| `i18n.ts` | `pickLocale` |
| `cache.ts` | `createLayerCache`, `invalidateLayer`, `refreshLayer`, `LayerCache` |
| `attrscreen.ts` | `createAttrScreen`, `clearAttrScreen`, `stampMono`, `flushAttrScreen`, `AttrScreen`, `AttrPolicy` |
| `monoscreen.ts` | `createMonoScreen`, `clearMonoScreen`, `drawMonoBitmap`, `fillMono`, `flushMonoScreen`, `MonoScreen` |
| `music.ts` | `noteToFreq`, `seq`, `playAYLoop`, `SeqOptions`, `LoopHandle` |
| `presentation.ts` | `blinkVisible`, `drawBlinkingText`, `drawTapeStripes`, `drawMenuOptions`, `TapeStripesOptions`, `MenuOptionsConfig` |
| `debug.ts` | `createDebugMonitor`, `beginFrame`, `endFrame`, `sampleDebug`, `drawDebugOverlay`, `DebugInfo`, `DebugMonitor` |

**API stability:** module Stable/Experimental classification, deprecation policy, and the road to 1.0 live in `docs/api-stability.md`. Experimental today: `music`, `presentation`, `lighting` — everything else is Stable. Only the root export is public (no subpaths); `_`-prefixed / non-barrel symbols are internal.

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

Test files live at the project root (`*.tests.ts`). Run with `npm test`. Tests use `jsdom` for DOM globals.

## Release pipeline

Semantic-release on push to `main`. Commit message format: `feat:`, `fix:`, `chore:` etc. The CI pipeline bumps version, updates CHANGELOG.md, and publishes to npm automatically.

## Known issues

`npm audit` flags 1 high vuln (**undici 6.26.0**) — it is **bundled inside the `npm` CLI** (pulled into dev by semantic-release) and is **unfixable downstream** (npm's own `audit fix` says so). It is **dev/CI-only and never shipped** (zx-kit publishes zero runtime deps; consumers never receive undici). **Don't re-investigate** — `audit fix`/`--force`/`overrides`/lockfile-nuke/global-npm-upgrade were all tried and proven ineffective (2026-06-20). Full note + proof: `docs/known-issues.md`. Clears when upstream npm bundles a patched undici.
