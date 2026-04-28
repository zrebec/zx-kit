# zx-kit

Reusable ZX Spectrum primitives for browser games built with Vite + TypeScript + Canvas + Web Audio API.

Extracted from [Minefield](https://github.com/zrebec/minefield) — a ZX Spectrum-style minesweeper game. All modules enforce strict Spectrum authenticity: 8×8 pixel grid, 15-color palette, 1-bit square-wave audio, bitmap font.

---

## Installation

The package ships TypeScript source directly (no build step). Consume it via a local path in `package.json`:

```json
"dependencies": {
  "zx-kit": "file:../zx-kit"
}
```

Then add a Vite alias so bundler resolution works (Vite doesn't transform `node_modules` by default):

```ts
// vite.config.ts
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: { 'zx-kit': resolve(__dirname, '../zx-kit/src/index.ts') },
  },
})
```

Import from the barrel:

```ts
import { C, CELL, initAudio, beep, drawSprite, initInput, tickMovement } from 'zx-kit'
```

---

## Modules

### `palette.ts` — ZX Spectrum color constants

Defines the exact 15 colors of the ZX Spectrum and the 8-pixel cell size. **Never use any other hex values** — all game graphics must stay within this palette.

#### Exports

| Export | Type | Value | Description |
|--------|------|-------|-------------|
| `SCALE` | `number` | `4` | CSS pixel scale factor (1 game pixel = 4 CSS pixels) |
| `CELL` | `number` | `8` | Sprite / character grid size in game pixels |
| `C` | `object` | see below | All 15 Spectrum colors as `#RRGGBB` hex strings |
| `SpectrumColor` | `type` | union of all `C` values | TypeScript type for palette-safe color values |

#### Color table (`C` object)

Normal brightness colors (prefix-less):

| Key | Hex | Appearance |
|-----|-----|-----------|
| `C.BLACK` | `#000000` | Black |
| `C.BLUE` | `#0000CD` | Dark blue |
| `C.RED` | `#CD0000` | Dark red |
| `C.MAGENTA` | `#CD00CD` | Dark magenta |
| `C.GREEN` | `#00CD00` | Dark green |
| `C.CYAN` | `#00CDCD` | Dark cyan |
| `C.YELLOW` | `#CDCD00` | Dark yellow |
| `C.WHITE` | `#CDCDCD` | Light grey |

Bright variants (`B_` prefix):

| Key | Hex | Appearance |
|-----|-----|-----------|
| `C.B_BLACK` | `#000000` | Same as `BLACK` |
| `C.B_BLUE` | `#0000FF` | Bright blue |
| `C.B_RED` | `#FF0000` | Bright red |
| `C.B_MAGENTA` | `#FF00FF` | Bright magenta |
| `C.B_GREEN` | `#00FF00` | Bright green |
| `C.B_CYAN` | `#00FFFF` | Bright cyan |
| `C.B_YELLOW` | `#FFFF00` | Bright yellow |
| `C.B_WHITE` | `#FFFFFF` | Pure white |

#### Usage example

```ts
import { C, CELL } from 'zx-kit'

ctx.fillStyle = C.B_CYAN    // bright cyan
ctx.fillRect(x, y, CELL, CELL)
```

---

### `font.ts` — ZX Spectrum ROM bitmap font

Contains the exact ZX Spectrum ROM character set — 96 printable characters (ASCII 32–127), each stored as 8 bytes (one byte per row, bit 7 = leftmost pixel). Character 127 is a solid block `█`, used for things like life counters.

The font data is sourced from the original Spectrum ROM and must not be altered — any change breaks Spectrum authenticity.

#### Exports

| Export | Type | Description |
|--------|------|-------------|
| `FONT` | `Uint8Array` | Flat array: 96 chars × 8 bytes = 768 bytes total. `FONT[(charCode-32)*8 + row]` = one row bitmap. |
| `getCharRow(charCode, row)` | `(number, number) => number` | Returns the bitmap byte for the given ASCII code and row (0–7). Returns `0` for out-of-range codes. |

#### Usage example

```ts
import { getCharRow } from 'zx-kit'

// Draw character 'A' (65) row by row
for (let row = 0; row < 8; row++) {
  const byte = getCharRow(65, row)
  for (let bit = 0; bit < 8; bit++) {
    if (byte & (0x80 >> bit)) {
      ctx.fillRect(x + bit, y + row, 1, 1)
    }
  }
}
```

In practice you won't need this directly — use `drawChar` / `drawText` from `renderer.ts` instead.

---

### `renderer.ts` — Canvas drawing primitives

All drawing functions work in **game pixels** (not CSS pixels). At `SCALE=4` each game pixel maps to a 4×4 CSS pixel block. Canvas must have `imageSmoothingEnabled = false` set once at init.

Every function follows the ZX Spectrum **ink / paper** model: each 8×8 cell has exactly one foreground color (ink) and one background color (paper).

#### Exports

##### `mirrorSprite(src: Uint8Array): Uint8Array`

Flips an 8×8 sprite horizontally. Returns a new `Uint8Array`. Used to derive left-facing sprites from right-facing ones at module load time.

```ts
import { mirrorSprite } from 'zx-kit'

export const PLAYER_RIGHT = new Uint8Array([0x18, 0x3C, ...])
export const PLAYER_LEFT  = mirrorSprite(PLAYER_RIGHT)
```

##### `drawSprite(ctx, sprite, x, y, ink, paper): void`

Draws an 8×8 sprite at game coordinates `(x, y)`. Always fills the full 8×8 cell with `paper` first, then renders `ink` pixels from the sprite bitmap.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ctx` | `CanvasRenderingContext2D` | Target canvas context |
| `sprite` | `Uint8Array` | 8-byte sprite (one byte per row) |
| `x` | `number` | Left edge in game pixels |
| `y` | `number` | Top edge in game pixels |
| `ink` | `string` | Foreground color (Spectrum palette hex) |
| `paper` | `string` | Background color (Spectrum palette hex) |

```ts
import { drawSprite, C } from 'zx-kit'

drawSprite(ctx, MINE_SPRITE, col * 8, row * 8, C.B_RED, C.BLACK)
```

##### `drawChar(ctx, code, x, y, ink, paper?): void`

Draws a single ASCII character at game coordinates using the ROM font. If `paper` is omitted, the background is not cleared (transparent background).

| Parameter | Type | Description |
|-----------|------|-------------|
| `ctx` | `CanvasRenderingContext2D` | Target canvas context |
| `code` | `number` | ASCII character code (32–127) |
| `x` | `number` | Left edge in game pixels |
| `y` | `number` | Top edge in game pixels |
| `ink` | `string` | Foreground color |
| `paper?` | `string` | Optional background color |

```ts
import { drawChar, C } from 'zx-kit'

drawChar(ctx, 127, x, y, C.B_GREEN, C.BLACK)  // solid block █
```

##### `drawText(ctx, text, x, y, ink, paper?): void`

Draws a string left-to-right starting at `(x, y)`, one character per `CELL`-wide slot.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ctx` | `CanvasRenderingContext2D` | Target canvas context |
| `text` | `string` | ASCII string to render |
| `x` | `number` | Left edge in game pixels |
| `y` | `number` | Top edge in game pixels |
| `ink` | `string` | Foreground color |
| `paper?` | `string` | Optional background color |

```ts
import { drawText, C } from 'zx-kit'

drawText(ctx, 'SCORE:00000', 0, statusY, C.B_WHITE, C.BLACK)
```

##### `drawTextCentered(ctx, text, y, cols, ink, paper?): void`

Draws a string horizontally centered within a canvas of `cols` character columns. The `cols` parameter must match your game's grid width (e.g. 32 for a standard Spectrum layout).

| Parameter | Type | Description |
|-----------|------|-------------|
| `ctx` | `CanvasRenderingContext2D` | Target canvas context |
| `text` | `string` | ASCII string to render |
| `y` | `number` | Top edge in game pixels |
| `cols` | `number` | Total character columns (canvas width ÷ CELL) |
| `ink` | `string` | Foreground color |
| `paper?` | `string` | Optional background color |

```ts
import { drawTextCentered, C } from 'zx-kit'

drawTextCentered(ctx, 'GAME  OVER', cy * 8, 32, C.B_RED, C.BLACK)
```

**Tip for game code:** Bind `cols` once to avoid passing it everywhere:

```ts
function drawCentered(ctx: CanvasRenderingContext2D, text: string, y: number, ink: string, paper?: string) {
  drawTextCentered(ctx, text, y, COLS, ink, paper)
}
```

---

### `audio.ts` — Web Audio engine (ZX Spectrum style)

Wraps the Web Audio API to produce authentic 1-bit square-wave sound, exactly like the ZX Spectrum's single-channel beeper. All audio goes through a shared `AudioContext` and a single `GainNode` master bus.

**Important:** `AudioContext` must be created in response to a user gesture (click or keypress) due to browser autoplay policy. Call `initAudio()` from a key/click handler, then call `resumeAudio()` before playing sound in the game loop.

#### Exports

##### `initAudio(volume?: number): void`

Creates the `AudioContext` and master `GainNode`. Idempotent — safe to call multiple times (subsequent calls are no-ops). Default volume: `0.3`.

```ts
import { initAudio } from 'zx-kit'

document.addEventListener('keydown', () => initAudio(), { once: true })
```

##### `resumeAudio(): void`

Resumes a suspended `AudioContext`. Browsers suspend the context when the tab is hidden or on first load. Call this before scheduling any beep in the game loop.

```ts
import { resumeAudio, beep, getAudioContext } from 'zx-kit'

const ctx = getAudioContext()
if (ctx) {
  resumeAudio()
  beep(440, 80, ctx.currentTime)
}
```

##### `getAudioContext(): AudioContext | null`

Returns the current `AudioContext`, or `null` if `initAudio()` has not been called yet. Use this to get `currentTime` for scheduling beeps.

##### `getMasterGain(): GainNode | null`

Returns the master `GainNode`. Connect your own oscillators/gains to this node to respect the global volume level. Returns `null` before `initAudio()`.

```ts
const osc = ctx.createOscillator()
const gain = ctx.createGain()
osc.connect(gain)
gain.connect(getMasterGain()!)
```

##### `beep(freq: number, durationMs: number, startTime: number): void`

Schedules a single square-wave beep. Uses a 5ms linear ramp attack and release to avoid click artifacts. The beep is routed through the master gain.

| Parameter | Type | Description |
|-----------|------|-------------|
| `freq` | `number` | Frequency in Hz |
| `durationMs` | `number` | Duration in milliseconds |
| `startTime` | `number` | `AudioContext.currentTime` offset to start at |

```ts
import { beep, resumeAudio, getAudioContext } from 'zx-kit'

const ctx = getAudioContext()
if (ctx) {
  resumeAudio()
  const now = ctx.currentTime
  // Two-pip warning: 880Hz beep twice with 60ms gap
  beep(880, 80, now)
  beep(880, 80, now + 0.14)
}
```

---

### `input.ts` — Keyboard input with key-repeat

Handles arrow key movement with configurable key-repeat (first-press immediate, hold for auto-repeat), plus single-consume flags for action keys. Designed for grid-based games where one key press = one step.

**Important:** Call `initInput()` once at startup (after DOM is ready) to attach `keydown`/`keyup` listeners. Then call `tickMovement(dt)` every frame.

#### Exports

##### `initInput(repeatDelay?: number, repeatInterval?: number): void`

Attaches global `keydown`/`keyup` event listeners. Default values:
- `repeatDelay`: `150` ms — time before auto-repeat kicks in after initial press
- `repeatInterval`: `80` ms — time between repeats while key is held

```ts
import { initInput } from 'zx-kit'

initInput(150, 80)
```

##### `tickMovement(dtMs: number): Direction | null`

Call once per frame with the frame delta in milliseconds. Returns the direction to move this frame, or `null` if no movement. On the first frame a key is pressed, returns immediately. While held, returns a direction every `repeatInterval` ms (after initial `repeatDelay`).

```ts
import { tickMovement } from 'zx-kit'

function gameLoop(dtMs: number) {
  const dir = tickMovement(dtMs)
  if (dir) movePlayer(dir)
}
```

##### `consumeFlag(): boolean`

Returns `true` once if `F` key was pressed since the last call, then resets. Designed for the flag-placement action (mark suspected mine cell).

##### `consumeDebug(): boolean`

Returns `true` once if `Ctrl+Shift+B` was pressed. Used to toggle debug mode (reveal all mines). Calls `e.preventDefault()` to suppress browser shortcuts.

##### `consumePause(): boolean`

Returns `true` once if `P` key was pressed.

##### `consumeAnyKey(): boolean`

Returns `true` once if any key was pressed. Used to dismiss intro screens or game-over overlays.

##### `isHeld(key: string): boolean`

Returns whether a key is currently held. Argument is the `KeyboardEvent.key` string (e.g. `'ArrowUp'`, `' '`).

##### `Direction` type

```ts
export type Direction = 'up' | 'down' | 'left' | 'right'
```

---

## File structure

```
zx-kit/
├── package.json         # { "exports": { ".": "./src/index.ts" } }
├── tsconfig.json        # strict, bundler moduleResolution, noEmit
├── README.md
└── src/
    ├── index.ts         # barrel — re-exports everything
    ├── palette.ts       # SCALE, CELL, C color constants, SpectrumColor type
    ├── font.ts          # ROM font Uint8Array + getCharRow()
    ├── renderer.ts      # mirrorSprite, drawSprite, drawChar, drawText, drawTextCentered
    ├── audio.ts         # initAudio, resumeAudio, beep, getAudioContext, getMasterGain
    └── input.ts         # initInput, tickMovement, consumeFlag/Debug/Pause/AnyKey, isHeld
```

---

## Design principles

- **No build step in the library** — exports raw TypeScript source. Consuming project's bundler (Vite, esbuild) handles transpilation.
- **No runtime dependencies** — only Web platform APIs (`CanvasRenderingContext2D`, `AudioContext`, `KeyboardEvent`).
- **Strict TypeScript** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`. No `any`.
- **Singleton state** — `audio.ts` and `input.ts` hold module-level state. Suitable for single-game use; not suitable for running multiple independent game instances in the same page.
- **ZX Spectrum constraint enforcement** — palette, cell size, and font data are constants, not configuration. The library is deliberately opinionated.

---

## Migrating from inline code

When extracting from a game that previously had these utilities inline:

| What was inline | Now in zx-kit | Change required in game |
|-----------------|---------------|------------------------|
| `drawSprite`, `drawChar`, `drawText` | `renderer.ts` | Import from `'zx-kit'`; remove duplicate bodies |
| `drawTextCentered` | `renderer.ts` (takes `cols` param) | Wrap with a local helper that binds your game's `COLS` |
| `mirrorSprite` | `renderer.ts` | Import from `'zx-kit'`; keep sprite data in game's `sprites.ts` |
| `C` color object | `palette.ts` | Re-export from game's `constants.ts` via `export { C } from 'zx-kit'` |
| `SCALE`, `CELL` | `palette.ts` | Same as above |
| `FONT`, `getCharRow` | `font.ts` | Re-export from game's `font.ts` |
| `AudioContext` + `GainNode` init | `audio.ts` | Replace with `initAudio()` / `getAudioContext()` / `getMasterGain()` |
| `beep()` helper | `audio.ts` | Import directly; remove inline version |
| Arrow-key repeat logic | `input.ts` | Replace with `initInput()` + `tickMovement(dt)` |
| Flag / debug / pause key flags | `input.ts` | Use `consumeFlag()`, `consumeDebug()`, `consumePause()` |

---

## License

MIT
