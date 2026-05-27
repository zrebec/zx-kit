# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Roadmap anchor — May 2026

A retrospective was written after v0.16.0 (save system). It is the authoritative reference for where we are and what's next. Read it before suggesting new features or large refactors:

- **English:** `docs/retrospective.md`
- **Slovak:** `docs/retrospective.sk.md` (gitignored)

## ⛔ HARD BLOCK — Tests first, everything else after

**Do not implement new features, new modules, or start Frogger until all of the following are true:**

1. Every module has a `*.tests.ts` file.
2. Every exported function/type in every module has at least one test.
3. `npm test` passes with **≥ 75% line coverage** (ideally higher).

If the user asks for a new feature, a new module, or to start Frogger — **redirect to tests first**. Do not negotiate. Do not do "just a small thing first." The user explicitly requested this block.

The only exception: fixing a bug that is actively breaking something.

Module test priority order: `tilemap` → `animation` → `input` → `camera` → `collision` → `scene` → `renderer` → `ui` → `ay` → `audio`. `save.ts` already has 31 tests — maintain them.

**Phase 2 — Frogger clone (locked until Phase 1 is done)**
Minefield has nothing left to offer as a test bed. Frogger validates Camera, Collision, and Scene manager in a real game. Not before tests.

**Do not add** `physics.ts`, `particle.ts`, network, or multiplayer modules. Spectrum philosophy: less is more.

## Current status

`zx-kit` v0.16.0 is a published, fully installable npm package. It ships compiled JS + `.d.ts` from `dist/` and exports from `./dist/index.js`. No Vite aliases or path hacks are needed.

The sibling project at `/Users/zrebec/Projects/minefield` consumes `zx-kit` via `"zx-kit": "^0.16.0"`.

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
| `audio.ts` | `initAudio`, `resumeAudio`, `beep`, `playPattern`, `getAudioContext`, `getMasterGain`, `getMasterVolume`, `setMasterVolume`, `increaseVolume`, `decreaseVolume` |
| `ay.ts` | `createAY`, `playAY`, `AY_CLOCK`, `AY_VOL`, `AY_ENVELOPE_SHAPES`, `AYChannel`, `AYNote`, `AYChip` |
| `input.ts` | `initInput`, `tickMovement`, `consumeFlag`, `consumeDebug`, `consumePause`, `consumeAnyKey`, `isHeld`, `resetInput`, `Direction` |
| `sprite.ts` | `createSprite`, `moveSprite`, `applyGravity`, `renderSprite`, `Sprite` |
| `collision.ts` | `spriteRect`, `rectsOverlap`, `spritesOverlap`, `isSolidAt`, `resolveX`, `resolveY`, `Rect`, `bitmapPixelMask`, `masksOverlap`, `pixelSolidCount`, `PixelMask` |
| `animation.ts` | `createAnimation`, `tickAnimation`, `getAnimationFrame`, `resetAnimation`, `createTween`, `tickTween`, `createBlinker`, `tickBlinker`, `Animation`, `Tween`, `Blinker`, `Easings` |
| `camera.ts` | `createCamera`, `setCameraTarget`, `tickCamera`, `worldToScreen`, `isInView`, `Camera` |
| `scene.ts` | `createSceneManager`, `pushScene`, `popScene`, `replaceScene`, `currentScene`, `updateScenes`, `renderScenes`, `Scene` |
| `tilemap.ts` | `createTileMap`, `setTile`, `getTile`, `clearTile`, `fill`, `fillRect`, `isSolid`, `findById`, `render`, `setBackground`, `Tile`, `Viewport`, `TileMap` |
| `ui.ts` | `drawBox`, `drawFrame`, `drawPanelTitle`, `drawDottedGrid`, `drawSegmentedBar`, `drawTank`, `drawDial`, `drawCompassText`, `drawProgressBar`, `tickUI`, `renderUI`, `resetUI`, `BorderOptions`, `DrawProgressBarOptions` |
| `i18n.ts` | `pickLocale` |

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
