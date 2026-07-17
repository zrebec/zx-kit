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

**Next: stabilisation, not new modules.** The library is feature-complete for its scope; the remaining work is docs/packaging hygiene and public-API stabilisation toward 1.0 — not engine surface. Done already: tests no longer ship in `dist`; `.gitattributes` locks line endings to LF; and the **README split (K4) is complete** — the former ~3k-line README is now a 271-line landing page plus `docs/{getting-started,rendering,audio,collision,save,api,examples}.md`. Next up: public-API stabilisation (stable/experimental classification, deprecation policy) toward 1.0. **No flagship "kitchen-sink" demo or GitHub Pages landing — that idea (K5) is dropped; Minefield and chaosBunny are the demo.** See `retro/docs/portfolio/tasks_all_projects.md` (K-items) for the live list, and `retro/docs/sk/zx-kit.md` for the consolidated SK working doc.

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
