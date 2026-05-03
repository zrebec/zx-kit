# zx-kit

Reusable ZX Spectrum primitives for browser games built with Vite + TypeScript + Canvas + Web Audio API.

Current npm package: `zx-kit@0.8.0`.

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
const centered = (ctx: CanvasRenderingContext2D, text: string, y: number, ink: SpectrumColor) =>
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

Creates the `AudioContext` and master gain. Idempotent — safe to call multiple times. `volume` is clamped to 0.0–1.0.

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

#### `getMasterVolume(): number`

Returns the current master volume (0.0–1.0), or `0` before `initAudio()`.

#### `setMasterVolume(volume): void`

Sets master volume. Clamped to 0.0–1.0. No-op before `initAudio()`.

```ts
setMasterVolume(0.5)  // 50%
setMasterVolume(0)    // mute
setMasterVolume(1)    // full
```

#### `increaseVolume(): void` / `decreaseVolume(): void`

Adjusts master volume by ±0.1, clamped at 0.0–1.0.

```ts
// Volume keys
if (consumeAnyKey()) increaseVolume()  // example: + key
decreaseVolume()                        // example: - key

// Current state
const vol = getMasterVolume()  // e.g. 0.4 after one increaseVolume()
```

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

Attaches `keydown`/`keyup` listeners. Idempotent — timing params are always updated; listeners are only attached on the first call. Keys: arrows = movement, `F` = flag, `P` = pause, `Ctrl+Shift+B` = debug.

```ts
initInput()         // 150ms delay, 80ms repeat
initInput(200, 60)  // custom timing; safe to call again to reconfigure
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

#### `resetInput(): void`

Clears all pending key state immediately. Call on game phase transitions to prevent stale inputs carrying over.

```ts
appPhase = 'gameover'
resetInput()  // discard any queued keypresses from the previous phase
```

---

### `ui.ts` — ZX-style UI primitives

High-level drawing helpers and a stateful widget system for HUD elements.
All primitives operate in game pixels and enforce the Spectrum palette via `SpectrumColor`.

#### Types

**`BorderOptions`**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Set to `false` to suppress the border without removing the object |
| `thickness` | `number` | `1` | Border thickness in pixels |
| `color` | `SpectrumColor` | same as ink/color | Overrides the parent function's foreground color |
| `style` | `'solid' \| 'dashed'` | `'solid'` | Solid = continuous lines; dashed = 2 px on / 2 px off |

**`DrawProgressBarOptions`**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | `"${x},${y}"` | Stable key for managed redraws |
| `x` | `number` | — | Left edge in game pixels |
| `y` | `number` | — | Top edge in game pixels |
| `width` | `number` | — | Total width in game pixels (multiples of `CELL = 8` recommended) |
| `value` | `number` | — | Current value |
| `min` | `number` | `0` | Value at the left (empty) edge |
| `max` | `number` | `1` | Value at the right (full) edge |
| `ink` | `SpectrumColor` | `C.B_WHITE` | Filled-block color |
| `paper` | `SpectrumColor` | `C.BLACK` | Empty-block background |
| `border` | `BorderOptions` | — | Optional border around the bar |
| `visibilityLength` | `number` | `500` | Ms to stay visible after last call; `0` = permanent |

#### Stateless primitives

##### `drawBox(ctx, options): void`

Fills a rectangle with `paper` and draws an optional border.

```ts
drawBox(ctx, {
  x: 8, y: 8, width: 112, height: 40,
  paper: C.BLACK, ink: C.B_WHITE,
  border: { style: 'solid', thickness: 1 },
})
```

##### `drawFrame(ctx, options): void`

Draws a border only — no background fill.

```ts
drawFrame(ctx, { x: 0, y: 0, width: 256, height: 176, color: C.B_CYAN })
drawFrame(ctx, { x: 16, y: 16, width: 64, height: 32, color: C.B_RED,
  border: { style: 'dashed' } })
```

##### `drawPanelTitle(ctx, options): void`

Renders a text strip (height = `CELL + padding * 2`) with optional background fill.
Does NOT draw the surrounding container — use `drawBox` / `drawFrame` separately.

```ts
drawBox(ctx, { x: 8, y: 24, width: 128, height: 56, paper: C.BLACK })
drawPanelTitle(ctx, {
  text: 'OPTIONS', x: 8, y: 24,
  ink: C.B_YELLOW, paper: C.BLACK,
  centered: true, width: 128,
})
```

#### Stateful widget — progress bar

The progress bar is a managed widget: after a `drawProgressBar` call, the bar is
re-rendered automatically on subsequent frames by `renderUI` until `visibilityLength`
milliseconds have elapsed. Calling `drawProgressBar` again resets the timer.

##### `drawProgressBar(ctx, options): void`

Draws the bar immediately **and** registers it for managed redraws.

```ts
// On value change:
drawProgressBar(ctx, {
  id: 'volume', x: 88, y: 88, width: 80,
  value: getMasterVolume(),
  ink: C.B_GREEN, paper: C.BLACK,
  border: { style: 'solid' },
  visibilityLength: 1500,
})

// Permanent HUD element:
drawProgressBar(ctx, {
  id: 'health', x: 0, y: 184, width: 40,
  value: lives, min: 0, max: 3,
  ink: C.B_GREEN, paper: C.BLACK,
  visibilityLength: 0,
})
```

##### `tickUI(dtMs): void`

Advances all managed bar timers. Expired bars are removed. Call once per frame.

##### `renderUI(ctx): void`

Redraws all currently visible bars. Call every frame **after** the game world render.

##### `resetUI(): void`

Clears all managed state. Call alongside `resetInput()` on phase transitions.

```ts
// Typical game loop:
renderFrame(ctx, state)
tickUI(dt)
renderUI(ctx)

// Phase transition:
resetInput()
resetUI()
appPhase = 'intro'
```

---

### `tilemap.ts` — Scrollable tile map

A scrollable, queryable `TileMap` backed by an O(1) id-index. Tiles use the same 8×8 sprite format as `drawSprite`. Supports seasonal background swapping, viewport-clipped rendering, collision queries, and fast id-based lookups.
Tile colours are palette-typed: `ink` and `paper` must be `SpectrumColor` values from `C`.

#### Types

**`Tile`**

| Field | Type | Description |
|-------|------|-------------|
| `sprite` | `Uint8Array` | 8-byte bitmap — same format as `drawSprite()` |
| `ink` | `SpectrumColor` | Foreground colour (`C.*` palette value) |
| `paper` | `SpectrumColor` | Background colour (`C.*` palette value) |
| `solid` | `boolean` | `true` = blocks movement (walls, rocks, closed doors) |
| `id` | `string \| number` | Stable identifier for game logic and background swapping |
| `metadata?` | `Record<string, unknown>` | Optional game-specific payload (points, next level, …) |

**`Viewport`**

| Field | Type | Description |
|-------|------|-------------|
| `x` | `number` | First visible column (tile units) |
| `y` | `number` | First visible row (tile units) |
| `cols` | `number` | Number of columns to render |
| `rows` | `number` | Number of rows to render |

#### `createTileMap(cols, rows): TileMap`

Creates an empty map of `cols × rows` tiles — all cells start `null`. Returns a plain object implementing the `TileMap` interface (factory pattern, consistent with the rest of zx-kit).

#### Method reference

| Method | Description |
|--------|-------------|
| `setTile(x, y, tile)` | Store a shallow copy of `tile`. Out-of-bounds is a silent no-op. |
| `getTile(x, y)` | Return the tile at `(x, y)`, or `null`. Never throws. |
| `clearTile(x, y)` | Remove the tile (e.g. collect gem, break wall). Out-of-bounds is a no-op. |
| `fill(tile)` | Fill every cell with independent shallow copies of `tile`. |
| `fillRect(x, y, w, h, tile)` | Fill a rectangle; regions outside the map are silently clipped. |
| `setBackground(tile)` | Register or swap the background tile (see below). |
| `render(ctx, viewport?)` | Render the map or viewport via `drawSprite`. Empty cells are skipped. |
| `isSolid(x, y)` | `true` when the tile is solid, or when the position is out-of-bounds. |
| `findById(id)` | Return `{ x, y, tile }[]` for all tiles with the given `id` — O(1). |

#### Smart background swapping (`setBackground`)

`setBackground` has two modes depending on whether a background has been registered before:

- **First call** — registers the tile as the current background. The map is not modified; call `fill` or `fillRect` first to actually place the background tiles.
- **Subsequent calls (smart swap)** — replaces every cell whose `id` still matches the previous background with a fresh copy of the new tile. Cells with any other `id` (player, gems, rocks, modified terrain) are left completely untouched.

Comparison is by `id` value, so it works correctly after shallow copies.

```ts
map.fill(TILE_GRASS)
map.setBackground(TILE_GRASS)      // register — map unchanged

map.setTile(5, 3, TILE_PLAYER)     // player placed on grass

map.setBackground(TILE_SNOW)       // TILE_GRASS → TILE_SNOW everywhere
                                   // TILE_PLAYER at (5, 3) — untouched

map.setBackground(TILE_NIGHT)      // TILE_SNOW → TILE_NIGHT
                                   // TILE_PLAYER — still untouched
```

---

#### Boulder Dash-style level

A complete setup showing map construction, collision detection, item collection, and seasonal background swap — the typical usage pattern for a scrollable ZX Spectrum-style game.

```ts
import { createTileMap, C, CELL } from 'zx-kit'
import type { Tile, Viewport } from 'zx-kit'

// ── Tile definitions ──────────────────────────────────────────────────────────

const TILE_DIRT: Tile = {
  sprite: new Uint8Array([0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA]),
  ink: C.YELLOW, paper: C.BLACK,
  solid: false, id: 'dirt',
}
const TILE_WALL: Tile = {
  sprite: new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]),
  ink: C.WHITE, paper: C.BLACK,
  solid: true, id: 'wall',
}
const TILE_ROCK: Tile = {
  sprite: new Uint8Array([0x3C, 0x7E, 0xFF, 0xFF, 0xFF, 0xFF, 0x7E, 0x3C]),
  ink: C.B_WHITE, paper: C.BLACK,
  solid: true, id: 'rock',
}
const TILE_GEM: Tile = {
  sprite: new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x3C, 0x18]),
  ink: C.B_CYAN, paper: C.BLACK,
  solid: false, id: 'gem',
  metadata: { points: 10 },
}
const TILE_EXIT: Tile = {
  sprite: new Uint8Array([0x3C, 0x42, 0x99, 0xA5, 0xA5, 0x99, 0x42, 0x3C]),
  ink: C.B_YELLOW, paper: C.BLACK,
  solid: false, id: 'exit',
  metadata: { nextLevel: 2 },
}

// ── Map setup ─────────────────────────────────────────────────────────────────

const COLS = 64
const ROWS = 32
const map = createTileMap(COLS, ROWS)

// Fill with dirt and register it as the seasonal background
map.fill(TILE_DIRT)
map.setBackground(TILE_DIRT)

// Perimeter walls
map.fillRect(0, 0, COLS, 1, TILE_WALL)            // top
map.fillRect(0, ROWS - 1, COLS, 1, TILE_WALL)     // bottom
map.fillRect(0, 0, 1, ROWS, TILE_WALL)             // left
map.fillRect(COLS - 1, 0, 1, ROWS, TILE_WALL)      // right

// Objects
map.setTile(10, 5, TILE_ROCK)
map.setTile(20, 14, TILE_GEM)
map.setTile(35, 10, TILE_GEM)
map.setTile(60, 15, TILE_EXIT)

// ── Seasonal swap ─────────────────────────────────────────────────────────────

const TILE_SNOW: Tile = {
  sprite: new Uint8Array([0x00, 0x18, 0x3C, 0xFF, 0x3C, 0x18, 0x00, 0x00]),
  ink: C.B_WHITE, paper: C.BLACK,
  solid: false, id: 'snow',
}

// Winter: only dirt tiles become snow — walls, rocks, gems, exit are untouched
map.setBackground(TILE_SNOW)

// ── Game loop ─────────────────────────────────────────────────────────────────

const SCREEN_COLS = 32
const SCREEN_ROWS = 24
let playerX = 2
let playerY = 2
let score = 0

function gameLoop(ctx: CanvasRenderingContext2D) {
  // Clamp camera so it doesn't scroll past map edges
  const camX = Math.max(0, Math.min(playerX - Math.floor(SCREEN_COLS / 2), COLS - SCREEN_COLS))
  const camY = Math.max(0, Math.min(playerY - Math.floor(SCREEN_ROWS / 2), ROWS - SCREEN_ROWS))

  map.render(ctx, { x: camX, y: camY, cols: SCREEN_COLS, rows: SCREEN_ROWS })
}

// ── Collision & interaction ───────────────────────────────────────────────────

function tryMove(dx: number, dy: number) {
  const nx = playerX + dx
  const ny = playerY + dy

  if (map.isSolid(nx, ny)) return  // wall, rock, or map boundary

  const target = map.getTile(nx, ny)
  if (target?.id === 'gem') {
    score += target.metadata!['points'] as number
    map.clearTile(nx, ny)
  }

  playerX = nx
  playerY = ny
}

// ── Level completion ──────────────────────────────────────────────────────────

const exits = map.findById('exit')   // O(1) — no map scan
if (exits.some(e => e.x === playerX && e.y === playerY)) {
  const next = exits[0].tile.metadata!['nextLevel'] as number
  console.log(`Loading level ${next}`)
}

// Count remaining gems
const gemsLeft = map.findById('gem').length
console.log(`${gemsLeft} gems remaining`)
```

---

### `sprite.ts` — Free-roaming entity system

Sprites are entities that move freely in pixel space — not locked to the tile grid like `TileMap` cells. Use sprites for players, enemies, bullets, particles: anything that moves at sub-pixel precision or with physics.

Sprites use the same 8×8 bitmap format as `drawSprite` and the same `SpectrumColor` palette. They integrate directly with `resolveX` / `resolveY` from `collision.ts` and with `TileMap.isSolid` for platformer-style collision detection.

#### `Sprite` interface

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `x` | `number` | `0` | Horizontal position in game pixels (float allowed — rounded on render) |
| `y` | `number` | `0` | Vertical position in game pixels |
| `vx` | `number` | `0` | Horizontal velocity in pixels per millisecond |
| `vy` | `number` | `0` | Vertical velocity in pixels per millisecond |
| `bitmap` | `Uint8Array` | — | 8-byte sprite — one byte per row, bit 7 = leftmost pixel |
| `ink` | `SpectrumColor` | — | Foreground colour (`C.*` palette value) |
| `paper` | `SpectrumColor \| null` | `null` | Background colour, or `null` for transparent background |
| `flipX` | `boolean` | `false` | Render mirrored horizontally. Flipped bitmap is cached — no per-frame allocation |
| `visible` | `boolean` | `true` | When `false`, `renderSprite` skips this entity entirely |

#### `createSprite(bitmap, ink, paper?): Sprite`

Creates a `Sprite` at `(0, 0)` with zero velocity. `paper` defaults to `null` (transparent background).

```ts
import { createSprite, C } from 'zx-kit'

const PLAYER_BM = new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x18, 0x3C])
const BULLET_BM = new Uint8Array([0x00, 0x00, 0x18, 0x18, 0x18, 0x18, 0x00, 0x00])

const player = createSprite(PLAYER_BM, C.B_CYAN)          // transparent bg
const bullet = createSprite(BULLET_BM, C.B_WHITE, C.BLACK) // opaque bg
player.x = 16
player.y = 80
```

#### `moveSprite(sprite, dt): void`

Advances `sprite.x` by `vx * dt` and `sprite.y` by `vy * dt`. Call once per frame **before** collision resolution.

```ts
// Typical frame update order:
applyGravity(player, 0.003, dt)
moveSprite(player, dt)
const rx = resolveX(player, map, player.x)
const ry = resolveY(player, map, player.y)
player.x = rx.x
player.y = ry.y
if (ry.hitBottom) player.vy = 0
```

#### `applyGravity(sprite, gravity, dt): void`

Adds `gravity * dt` to `sprite.vy`. Call once per frame **before** `moveSprite`.

- `gravity` is in pixels per millisecond² — typical values: `0.002`–`0.005`
- Accumulates naturally across frames so the sprite accelerates while airborne

```ts
// Gentle gravity (platformer)
applyGravity(player, 0.003, dt)

// Strong gravity (bullet hell with falling debris)
applyGravity(debris, 0.008, dt)
```

#### `renderSprite(ctx, sprite): void`

Draws the sprite at `(Math.round(sprite.x), Math.round(sprite.y))`.
Skips if `sprite.visible === false`.
Respects `flipX` (cached mirror) and `paper: null` (transparent — only ink pixels drawn).

Call **after** all physics updates and collision resolution, as the last step before `drawScanlines`.

```ts
// Transparent sprite over a scrolling background
player.paper = null   // default — no background square
renderSprite(ctx, player)

// Opaque sprite (always paints its 8×8 cell background)
bullet.paper = C.BLACK
renderSprite(ctx, bullet)

// Facing direction
player.flipX = (player.vx < 0)
renderSprite(ctx, player)
```

#### Full example — platformer player

```ts
import { createSprite, moveSprite, applyGravity, renderSprite, C, CELL } from 'zx-kit'
import { resolveX, resolveY } from 'zx-kit'
import { tickMovement, consumeFlag } from 'zx-kit'

const PLAYER_BM = new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x24, 0x66])

const player = createSprite(PLAYER_BM, C.B_CYAN)
player.x = 2 * CELL
player.y = 10 * CELL

let onGround = false
const JUMP_VELOCITY = -0.25    // pixels/ms upward
const WALK_VELOCITY =  0.08    // pixels/ms horizontal
const GRAVITY       =  0.003   // pixels/ms²

function updatePlayer(dt: number, map: TileMap) {
  // Input
  const dir = tickMovement(dt)
  player.vx = dir === 'right' ?  WALK_VELOCITY
            : dir === 'left'  ? -WALK_VELOCITY
            : 0
  if (dir === 'up' && onGround) player.vy = JUMP_VELOCITY

  // Flip sprite to face movement direction
  if (player.vx < 0) player.flipX = true
  if (player.vx > 0) player.flipX = false

  // Physics
  applyGravity(player, GRAVITY, dt)
  moveSprite(player, dt)

  // Collision
  const rx = resolveX(player, map, player.x)
  player.x = rx.x
  if (rx.hitLeft || rx.hitRight) player.vx = 0

  const ry = resolveY(player, map, player.y)
  player.y = ry.y
  onGround = ry.hitBottom
  if (ry.hitBottom || ry.hitTop) player.vy = 0
}
```

---

### `collision.ts` — AABB collision detection and resolution

Axis-aligned bounding box (AABB) helpers for sprite-vs-sprite overlap tests and sprite-vs-`TileMap` collision resolution. All coordinates are in game pixels.

#### `Rect` interface

| Field | Type | Description |
|-------|------|-------------|
| `x` | `number` | Left edge in game pixels |
| `y` | `number` | Top edge in game pixels |
| `w` | `number` | Width in game pixels |
| `h` | `number` | Height in game pixels |

#### `spriteRect(sprite): Rect`

Returns the bounding `Rect` for a sprite — always `CELL × CELL` at the sprite's current position. Uses the raw float position (no rounding) for accurate same-frame overlap tests.

```ts
const rect = spriteRect(player)   // { x: 24.5, y: 80.0, w: 8, h: 8 }
```

#### `rectsOverlap(a, b): boolean`

Returns `true` when rectangles share at least one pixel. Touching edges (zero-area overlap) returns `false`.

```ts
rectsOverlap(spriteRect(bullet), spriteRect(enemy))  // hit test
rectsOverlap({ x: 0, y: 0, w: 32, h: 32 }, { x: 16, y: 16, w: 8, h: 8 })  // contained → true
```

#### `spritesOverlap(a, b): boolean`

Shorthand for `rectsOverlap(spriteRect(a), spriteRect(b))`.

```ts
if (spritesOverlap(player, coin)) collectCoin(coin)
if (bullets.some(b => spritesOverlap(b, player))) loseLife()
```

#### `isSolidAt(map, px, py): boolean`

Tests whether the game pixel `(px, py)` falls inside a solid tile. Converts to tile coordinates via `Math.floor(px / CELL)`. Out-of-bounds pixels return `true` — the map boundary is an implicit solid wall.

```ts
// Is the pixel directly below the player's feet solid?
if (isSolidAt(map, player.x, player.y + CELL)) onGround = true

// Same check via resolveY — usually more convenient
```

#### `resolveX(sprite, map, newX): { x, hitLeft, hitRight }`

Resolves a proposed horizontal move against solid tiles. Tests the leading edge of the sprite's bounding box at `newX` and returns the clamped position plus hit flags.

- `hitLeft` — the sprite hit a wall while moving left
- `hitRight` — the sprite hit a wall while moving right
- Always returns the original `newX` (unclamped) when no collision occurs
- Out-of-bounds overshoot is clamped correctly — the map boundary acts as an implicit wall

```ts
moveSprite(player, dt)
const { x, hitLeft, hitRight } = resolveX(player, map, player.x)
player.x = x
if (hitLeft || hitRight) player.vx = 0
```

#### `resolveY(sprite, map, newY): { y, hitTop, hitBottom }`

Resolves a proposed vertical move against solid tiles. Same contract as `resolveX`.

- `hitBottom` — the sprite landed on a floor tile (use to detect "on ground" for jump logic)
- `hitTop` — the sprite bumped its head on a ceiling tile

```ts
applyGravity(player, 0.003, dt)
moveSprite(player, dt)
const { y, hitBottom, hitTop } = resolveY(player, map, player.y)
player.y = y
if (hitBottom) { player.vy = 0; onGround = true }
if (hitTop)    { player.vy = 0 }
```

#### Full example — bullet hell enemy swarm

```ts
import { createSprite, moveSprite, renderSprite, spritesOverlap, C, CELL } from 'zx-kit'
import type { Sprite } from 'zx-kit'

const BULLET_BM = new Uint8Array([0x00, 0x18, 0x3C, 0x3C, 0x3C, 0x3C, 0x18, 0x00])
const ENEMY_BM  = new Uint8Array([0x3C, 0x7E, 0xFF, 0xDB, 0xFF, 0x66, 0x42, 0x81])

const bullets: Sprite[] = []
const enemies: Sprite[] = []

// Spawn a bullet traveling upward
function fireBullet(x: number, y: number) {
  const b = createSprite(BULLET_BM, C.B_YELLOW)
  b.x = x; b.y = y; b.vy = -0.3  // pixels/ms upward
  bullets.push(b)
}

// Spawn enemies in a row
for (let i = 0; i < 8; i++) {
  const e = createSprite(ENEMY_BM, C.B_RED, C.BLACK)
  e.x = i * 2 * CELL + 8
  e.y = 2 * CELL
  e.vx = 0.03 * (i % 2 === 0 ? 1 : -1)  // alternate directions
  enemies.push(e)
}

// Per-frame update
function updateBulletHell(dt: number) {
  // Move all bullets
  for (const b of bullets) moveSprite(b, dt)

  // Move all enemies
  for (const e of enemies) moveSprite(e, dt)

  // Hit tests — O(bullets × enemies), fine for dozens of sprites
  for (const b of bullets) {
    for (const e of enemies) {
      if (e.visible && b.visible && spritesOverlap(b, e)) {
        b.visible = false   // bullet disappears
        e.visible = false   // enemy explodes
      }
    }
  }

  // Remove off-screen bullets
  bullets.splice(0, bullets.length, ...bullets.filter(b => b.visible && b.y > -CELL))

  // Render
  for (const e of enemies) if (e.visible) renderSprite(ctx, e)
  for (const b of bullets) if (b.visible) renderSprite(ctx, b)
}
```

---

## File structure

```
zx-kit/
├── package.json           # exports: { ".": "./dist/index.js" }
├── tsconfig.json          # strict, emits to dist/
├── README.md
├── src/                   # TypeScript source
│   ├── index.ts           # barrel — re-exports everything
│   ├── palette.ts         # SCALE, CELL, C, SpectrumColor
│   ├── font.ts            # FONT, getCharRow
│   ├── renderer.ts        # setupCanvas, mirrorSprite, drawSprite, drawChar, drawText,
│   │                      # drawTextCentered, flashBorder, drawScanlines
│   ├── audio.ts           # initAudio, resumeAudio, beep, playPattern, Note,
│   │                      # getAudioContext, getMasterGain,
│   │                      # getMasterVolume, setMasterVolume,
│   │                      # increaseVolume, decreaseVolume
│   ├── input.ts           # initInput, tickMovement, consumeFlag/Debug/Pause/AnyKey,
│   │                      # isHeld, resetInput, Direction
│   ├── ui.ts              # drawBox, drawFrame, drawPanelTitle,
│   │                      # drawProgressBar, tickUI, renderUI, resetUI,
│   │                      # BorderOptions, DrawProgressBarOptions
│   ├── tilemap.ts         # createTileMap, Tile, Viewport, TileMap
│   ├── sprite.ts          # Sprite, createSprite, moveSprite, applyGravity, renderSprite
│   └── collision.ts       # Rect, spriteRect, rectsOverlap, spritesOverlap,
│                          # isSolidAt, resolveX, resolveY
└── dist/                  # compiled output (generated by npm run build)
    ├── index.js / .d.ts
    └── ...
```

---

## Design principles

- **Compiled distribution** — ships compiled JS + `.d.ts` in `dist/`. No bundler configuration needed in the consuming project.
- **No runtime dependencies** — only Web platform APIs (`CanvasRenderingContext2D`, `AudioContext`, `KeyboardEvent`).
- **Strict TypeScript** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`. No `any`.
- **Palette-typed game data** — UI colours and tile `ink` / `paper` use `SpectrumColor`, so consumers stay inside the Spectrum palette at compile time.
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
