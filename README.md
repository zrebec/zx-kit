# zx-kit

Reusable ZX Spectrum primitives for browser games built with Vite + TypeScript + Canvas + Web Audio API.

Extracted from [Minefield](https://github.com/zrebec/minefield) — a ZX Spectrum-style minesweeper game. All modules enforce strict Spectrum authenticity: 8×8 pixel grid, 15-color palette, 1-bit square-wave audio, bitmap font.

---

## Installation

```bash
npm install zx-kit
```

Import from the barrel:

```ts
import { C, CELL, setupCanvas, initAudio, playPattern, initInput, tickMovement } from 'zx-kit'
```

No Vite alias or path mapping required — the package ships compiled JavaScript (`dist/`).

---

## Quick start

```ts
import { setupCanvas, C, CELL, drawText, initAudio, playPattern, initInput, tickMovement } from 'zx-kit'

// Canvas — one call replaces the manual boilerplate
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = setupCanvas(canvas, 4)  // scale=4, 256×192 game px → 1024×768 CSS px

// Input
initInput()

// Audio (must be inside a user gesture)
window.addEventListener('keydown', () => initAudio(), { once: true })

// Game loop
function loop(dt: number) {
  const dir = tickMovement(dt)
  if (dir) movePlayer(dir)

  drawText(ctx, 'SCORE:00000', 0, 0, C.B_WHITE, C.BLACK)
  requestAnimationFrame(t => loop(t - lastT))
}
```

---

## Modules

### `palette.ts` — ZX Spectrum color constants

#### Exports

| Export | Type | Description |
|--------|------|-------------|
| `SCALE` | `number` | CSS pixel scale factor (1 game pixel = 4 CSS pixels) |
| `CELL` | `number` | Sprite / character grid size: `8` game pixels |
| `C` | `object` | All 15 Spectrum colors as `#RRGGBB` hex strings |
| `SpectrumColor` | `type` | Union of every value in `C` — use for compile-time palette enforcement |

#### Color table

Normal brightness:

| Key | Hex |
|-----|-----|
| `C.BLACK` | `#000000` |
| `C.BLUE` | `#0000CD` |
| `C.RED` | `#CD0000` |
| `C.MAGENTA` | `#CD00CD` |
| `C.GREEN` | `#00CD00` |
| `C.CYAN` | `#00CDCD` |
| `C.YELLOW` | `#CDCD00` |
| `C.WHITE` | `#CDCDCD` |

Bright variants (`B_` prefix):

| Key | Hex |
|-----|-----|
| `C.B_BLACK` | `#000000` |
| `C.B_BLUE` | `#0000FF` |
| `C.B_RED` | `#FF0000` |
| `C.B_MAGENTA` | `#FF00FF` |
| `C.B_GREEN` | `#00FF00` |
| `C.B_CYAN` | `#00FFFF` |
| `C.B_YELLOW` | `#FFFF00` |
| `C.B_WHITE` | `#FFFFFF` |

---

### `font.ts` — ZX Spectrum ROM bitmap font

96 printable characters (ASCII 32–127), each 8×8 pixels. Character 127 is a solid block █.

#### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `FONT` | `Uint8Array` | Flat array: 96 chars × 8 bytes. `FONT[(code-32)*8 + row]` = one row bitmap. |
| `getCharRow` | `(charCode, row) => number` | Bitmap byte for one row of a character (bit 7 = leftmost pixel). |

In practice use `drawChar` / `drawText` from `renderer.ts` — you rarely need `getCharRow` directly.

---

### `renderer.ts` — Canvas drawing primitives

All functions work in **game pixels**. At `SCALE=4` each game pixel maps to a 4×4 CSS pixel block. Call `setupCanvas` once at startup to configure the canvas correctly.

Every draw function follows the ZX Spectrum **ink / paper** model: each 8×8 cell has one foreground (ink) and one background (paper) color.

#### `setupCanvas(canvas, scale, width?, height?): CanvasRenderingContext2D`

Initialises a canvas element for pixel-perfect scaled rendering. Sets canvas dimensions, applies CSS size, disables image smoothing, and calls `ctx.scale(scale, scale)` so all subsequent draw calls use game-pixel coordinates. **Replaces the manual canvas setup boilerplate.**

- `scale` — CSS pixels per game pixel (`4` = standard ZX Spectrum display)
- `width` — game pixels wide (default `256`)
- `height` — game pixels tall (default `192`)

```ts
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = setupCanvas(canvas, 4)           // 256×192 game px → 1024×768 CSS px
const ctx = setupCanvas(canvas, 4, 256, 208) // taller canvas for status rows
// ctx.imageSmoothingEnabled is already false — no need to set it manually
// all draw calls use game-pixel coordinates — ctx.scale() is already applied
```

#### `mirrorSprite(src): Uint8Array`

Flips an 8×8 sprite horizontally. Returns a new `Uint8Array`.

```ts
export const PLAYER_RIGHT = new Uint8Array([...])
export const PLAYER_LEFT  = mirrorSprite(PLAYER_RIGHT)
```

#### `drawSprite(ctx, sprite, x, y, ink, paper): void`

Draws an 8×8 sprite at game coordinates. Always fills the background first.

```ts
drawSprite(ctx, MINE_SPRITE, col * CELL, row * CELL, C.B_RED, C.BLACK)
```

#### `drawChar(ctx, code, x, y, ink, paper?): void`

Draws one ASCII character using the ROM font. Omit `paper` for transparent background.

```ts
drawChar(ctx, 127, x, y, C.B_GREEN, C.BLACK)  // solid block █
drawChar(ctx, 'A'.charCodeAt(0), x, y, C.B_WHITE)
```

#### `drawText(ctx, text, x, y, ink, paper?): void`

Draws a string left-to-right, one character per `CELL`-wide slot.

```ts
drawText(ctx, 'SCORE:00000', 0, statusY, C.B_WHITE, C.BLACK)
```

#### `drawTextCentered(ctx, text, y, cols, ink, paper?): void`

Centers a string within `cols` character columns. Bind `cols` once in a helper to avoid repetition.

```ts
// Bind once:
const centered = (ctx: CanvasRenderingContext2D, text: string, y: number, ink: string) =>
  drawTextCentered(ctx, text, y, 32, ink)

centered(ctx, 'GAME  OVER', y, C.B_RED)
```

#### `flashBorder(color, times, intervalMs, resetColor?): void`

Flashes `document.body.style.backgroundColor` between `color` and `resetColor`. Fire-and-forget — does not block. One flash = one `color → resetColor` cycle. Always resets to `resetColor` on completion (default `C.BLACK`).

```ts
flashBorder(C.B_RED, 3, 150)           // explosion — 3 red flashes → black
flashBorder(C.B_GREEN, 2, 200)         // level complete
flashBorder(C.B_CYAN, 2, 120, C.BLUE)  // flash → reset to blue border
```

---

### `audio.ts` — Web Audio engine (ZX Spectrum style)

Wraps the Web Audio API for authentic 1-bit square-wave sound. All audio goes through a shared `AudioContext` and a single master `GainNode`.

**Browser autoplay policy:** `AudioContext` must be created inside a user gesture (click or keydown). Call `initAudio()` from an event handler.

#### `initAudio(volume?): void`

Creates the `AudioContext` and master gain. Idempotent — safe to call multiple times.

```ts
window.addEventListener('keydown', () => initAudio(), { once: true })
window.addEventListener('click',   () => initAudio(), { once: true })
```

#### `resumeAudio(): void`

Resumes a suspended `AudioContext`. Call before scheduling audio in the game loop.

#### `getAudioContext(): AudioContext | null`

Returns the current context, or `null` before `initAudio()`.

#### `getMasterGain(): GainNode | null`

Returns the master gain node. Connect custom oscillators here to respect global volume.

#### `Note` interface

```ts
interface Note {
  freq: number  // Hz — use 0 for a rest (silence)
  dur: number   // ms — duration of note or rest
}
```

#### `playPattern(notes, startDelay?): void`

Schedules a sequence of notes. `freq: 0` = rest (advances time, no sound). `startDelay` delays the whole pattern in milliseconds.

```ts
// Rising arpeggio
playPattern([
  { freq: 262, dur: 100 },  // C4
  { freq: 330, dur: 100 },  // E4
  { freq: 392, dur: 100 },  // G4
  { freq: 523, dur: 200 },  // C5
])

// With rests and a 200ms startup delay
playPattern([
  { freq: 523, dur: 120 },  // C5
  { freq: 0,   dur: 40  },  // rest
  { freq: 784, dur: 200 },  // G5
], 200)
```

#### `beep(freq, durationMs, startTime): void`

Schedules a single square-wave beep at an absolute `AudioContext.currentTime`. Use `playPattern` for sequences; use `beep` directly when you need algorithmic timing control.

```ts
const audio = getAudioContext()!
resumeAudio()
beep(880, 80, audio.currentTime)
beep(880, 80, audio.currentTime + 0.14)  // 140ms later
```

---

### `input.ts` — Keyboard input with key-repeat

Handles arrow-key movement with configurable key-repeat (immediate on first press, auto-repeat on hold) plus single-consume flags for action keys.

**Call `initInput()` once at startup.** Then call `tickMovement(dt)` every frame.

#### `Direction` type

```ts
type Direction = 'up' | 'down' | 'left' | 'right'
```

#### `initInput(repeatDelay?, repeatInterval?): void`

Attaches `keydown`/`keyup` listeners. Keys: arrows = movement, `F` = flag, `P` = pause, `Ctrl+Shift+B` = debug.

```ts
initInput()         // 150ms delay, 80ms repeat
initInput(200, 60)  // custom timing
```

#### `tickMovement(dtMs): Direction | null`

Returns the movement direction for this frame, or `null`. Call once per frame.

```ts
const dir = tickMovement(dt)
if (dir) movePlayer(dir)
```

#### Consume flags

| Function | Trigger | Use case |
|----------|---------|----------|
| `consumeFlag()` | `F` key | Flag / unflag a cell |
| `consumeDebug()` | `Ctrl+Shift+B` | Toggle debug mode |
| `consumePause()` | `P` key | Pause / unpause |
| `consumeAnyKey()` | Any key | Dismiss overlays, start game |

Each returns `true` once per press, then resets.

#### `isHeld(key): boolean`

Returns whether a key is currently held. Argument is `KeyboardEvent.key`.

```ts
if (isHeld('ArrowUp')) { ... }
```

---

## File structure

```
zx-kit/
├── package.json         # exports: { ".": "./dist/index.js" }
├── tsconfig.json        # strict, emits to dist/
├── README.md
├── src/                 # TypeScript source
│   ├── index.ts         # barrel — re-exports everything
│   ├── palette.ts       # SCALE, CELL, C, SpectrumColor
│   ├── font.ts          # FONT, getCharRow
│   ├── renderer.ts      # setupCanvas, mirrorSprite, drawSprite, drawChar, drawText,
│   │                    # drawTextCentered, flashBorder
│   ├── audio.ts         # initAudio, resumeAudio, beep, playPattern, Note,
│   │                    # getAudioContext, getMasterGain
│   └── input.ts         # initInput, tickMovement, consumeFlag/Debug/Pause/AnyKey,
│                        # isHeld, Direction
└── dist/                # compiled output (generated by npm run build)
    ├── index.js / .d.ts
    └── ...
```

---

## Design principles

- **Compiled distribution** — ships compiled JS + `.d.ts` in `dist/`. No bundler configuration needed in the consuming project.
- **No runtime dependencies** — only Web platform APIs (`CanvasRenderingContext2D`, `AudioContext`, `KeyboardEvent`).
- **Strict TypeScript** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`. No `any`.
- **Singleton state** — `audio.ts` and `input.ts` hold module-level state. Suitable for single-game use; not suitable for multiple independent game instances on the same page.
- **ZX Spectrum authenticity** — palette values, cell size, and font bytes are constants, not configuration. The library is deliberately opinionated.

---

## Local development

To work against a local checkout instead of the npm version:

```bash
# In your game project
npm install ../zx-kit --prefer-online
```

> The `--prefer-online` flag ensures npm resolves from the local path without caching issues.
> After publishing a new version to npm, switch back with `npm install zx-kit@latest`.

---

## License

MIT
