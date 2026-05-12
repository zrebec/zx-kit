# zx-kit

> **Build browser games that look and sound like a ZX Spectrum — without any of its limitations.**

Three-channel chiptune audio. Pixel-perfect canvas rendering. Authentic 15-color palette. ROM bitmap font. Tile maps with seasonal swapping. Physics-based sprites. Collision detection. A complete retro game engine in a single zero-dependency npm package.

[![npm](https://img.shields.io/npm/v/zx-kit)](https://www.npmjs.com/package/zx-kit)
[![license](https://img.shields.io/npm/l/zx-kit)](LICENSE)

---

## Why zx-kit?

The ZX Spectrum was a marvel of constraint. Its 8×8 pixel grid, 15-color palette, and 1-bit beeper defined an entire visual and sonic language. Thousands of games were made with nearly nothing — and they were unforgettable.

zx-kit lets you build in that same visual tradition, but with everything the original hardware was too limited to provide: three-channel AY-3-8912 chiptune audio with hardware-accurate envelopes and LFSR noise, smooth canvas rendering, physics-based sprites, and collision detection — all in TypeScript, all in the browser, all with zero dependencies.

The goal is simple: **it should look and sound like a Spectrum, but run like a modern game.**

---

## Key Features

- **AY-3-8912 Melodik emulator** — three independent square-wave channels, LFSR noise generator, all 16 hardware envelope shapes, logarithmic amplitude table accurate to the real chip
- **ZX Spectrum ROM font** — all 96 printable ASCII characters, 8×8 pixels, byte-for-byte faithful to the original ROM
- **Authentic 15-color palette** — normal and bright variants, palette-enforced at compile time via the `SpectrumColor` type
- **Canvas renderer** — pixel-perfect scaled rendering, sprite flipping, text drawing, CRT scanline overlay, animated border flashing
- **Tile map engine** — scrollable maps, O(1) id-index, smart seasonal background swapping, solid-tile collision queries
- **Free-roaming sprites** — position, velocity, gravity, `flipX` caching, transparent or opaque background
- **AABB collision resolution** — sprite vs. sprite overlap, sprite vs. tile map wall resolution with directional hit flags
- **Keyboard input** — configurable key-repeat, single-consume action flags, instant state reset on phase transitions
- **ZX-style UI widgets** — progress bars with managed lifetime, boxes, frames, panel titles
- **Zero dependencies** — only Web platform APIs: `Canvas`, `Web Audio`, `KeyboardEvent`
- **Tree-shakeable** — `sideEffects: false`, so unused modules are dropped from your production bundle
- **TypeScript-first** — strict mode, full `.d.ts` declarations, no `any`

---

## Live Demo

**[Minefield — ZX Spectrum Minesweeper](https://zrebec.github.io/minefield/)** — built entirely with zx-kit.

---

## Installation

### From npm (recommended)

```bash
npm install zx-kit
```

Then import directly — no Vite alias, no path mapping, no bundler configuration required:

```ts
import { setupCanvas, C, CELL, initAudio, playAY, initInput } from 'zx-kit'
```

The package ships compiled JavaScript (`dist/`) with full TypeScript declarations.

### From source (local / offline development)

Clone the repository and link it into your project:

```bash
# 1. Clone and build zx-kit
git clone https://github.com/zrebec/zx-kit.git
cd zx-kit
npm install
npm run build

# 2. In your game project — install from local path
npm install ../zx-kit
```

> Use `npm install ../zx-kit --prefer-online` if npm caches the local path aggressively.
> Switch back to the npm version any time: `npm install zx-kit@latest`

---

## Quick Start

A game loop in under 30 lines:

```ts
import {
  setupCanvas, C, CELL,
  drawText, drawSprite,
  initAudio, createAY,
  initInput, tickMovement,
} from 'zx-kit'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = setupCanvas(canvas, 4)  // 256×192 game px → 1024×768 CSS px

initInput()

// Audio must start inside a user gesture (browser policy)
let ay: ReturnType<typeof createAY> | null = null
window.addEventListener('keydown', () => {
  initAudio()
  ay = createAY()
  ay.tone('A', 440, 10)  // start a tone on channel A
}, { once: true })

const PLAYER = new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x24, 0x66])
let px = 120, py = 88

let last = performance.now()
function loop(now: number) {
  const dt = now - last; last = now

  const dir = tickMovement(dt)
  if (dir === 'left')  px -= 1
  if (dir === 'right') px += 1
  if (dir === 'up')    py -= 1
  if (dir === 'down')  py += 1

  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, 256, 192)
  drawText(ctx, 'ZX-KIT', 0, 0, C.B_GREEN, C.BLACK)
  drawSprite(ctx, PLAYER, px, py, C.B_CYAN, C.BLACK)

  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
```

---

## Modules

| Module | What it provides |
|--------|-----------------|
| [`ay.ts`](#ayts--ay-3-8912-melodik-audio) | AY chip emulator: 3-channel tone, LFSR noise, 16 envelope shapes |
| [`renderer.ts`](#rendererts--canvas-renderer) | Canvas setup, sprites, text, scanlines, border flash |
| [`audio.ts`](#audiots--beeper-audio) | 1-bit beeper: square-wave notes, patterns, volume control |
| [`ui.ts`](#uits--ui-widgets) | Progress bars, boxes, frames, panel titles |
| [`input.ts`](#inputts--keyboard-input) | Movement with key-repeat, action flags, state reset |
| [`sprite.ts`](#spritets--free-roaming-sprites) | Sprites: position, velocity, gravity, flip, render |
| [`collision.ts`](#collisionts--aabb-collision) | AABB overlap tests, tile-map wall resolution |
| [`animation.ts`](#animationts--frame-timer--tween) | Frame-timer for sprite strips, position tween between two points |
| [`camera.ts`](#camerats--scrolling-camera) | Viewport that follows a target with lerp + deadzone, world-bounds clamping |
| [`scene.ts`](#scenets--scene-manager) | Stack-based scene manager with onEnter/onExit/onPause/onResume hooks |
| [`tilemap.ts`](#tilemapts--tile-map-engine) | Scrollable maps, solid tiles, O(1) id-index, background swap |
| [`palette.ts`](#palettets--color-constants) | 15 Spectrum colors, `SpectrumColor` type, `CELL`, `SCALE` |
| [`font.ts`](#fontts--rom-bitmap-font) | 96-character ROM font, raw bitmap access |

---

## `ay.ts` — AY-3-8912 Melodik Audio

The AY-3-8912 chip (sold as the *Melodik* add-on for ZX Spectrum 48K, built into the 128K) gave the Spectrum three independent square-wave channels, a shared LFSR noise generator, and a hardware envelope generator with 16 distinct shapes. This module emulates all of it via the Web Audio API with hardware-accurate logarithmic amplitude values.

Two usage modes:

| Mode | Function | Use case |
|------|----------|----------|
| **Real-time** | `createAY()` | Persistent chip handle — set channels live (SFX, dynamic music) |
| **Sequencer** | `playAY(pattern)` | Pre-scheduled, fire-and-forget (music tracks, jingles) |

Both modes route through the zx-kit master `GainNode`, so `setMasterVolume()` works globally.

### `AY_CLOCK`

```ts
export const AY_CLOCK = 1_773_400  // Hz — ZX Spectrum 128K / Melodik
```

The AY-3-8912 master clock. Exported for use in frequency calculations:
`f_Hz = AY_CLOCK / (16 × period_register)`.

### `AY_VOL`

```ts
export const AY_VOL: readonly number[] = [
  0, 0.0089, 0.0118, 0.0156, 0.0211, 0.0289, 0.0403, 0.0549,
  0.0744, 0.1060, 0.1518, 0.2139, 0.2969, 0.4259, 0.6098, 1.0,
]
```

Hardware-accurate logarithmic amplitude table. Each step ≈ √2 (3 dB), matching the real chip's resistor ladder. Index 0 = silence, index 15 = full amplitude.

### `AY_ENVELOPE_SHAPES`

```ts
export const AY_ENVELOPE_SHAPES: readonly string[]
```

Human-readable names for all 16 R13 envelope shapes — useful for documentation, tooling, and debugging.

| R13 | Shape | Description |
|-----|-------|-------------|
| 0–3 | `\_ ` | One-shot decay, hold at zero |
| 4–7 | `/_ ` | One-shot attack, hold at zero |
| 8   | `\\\\` | Repeat decay (sawtooth down) |
| 9   | `\_`  | One-shot decay, hold at zero |
| 10  | `\/\/` | Alternate down/up (triangle) |
| 11  | `\‾`  | One-shot decay, hold at maximum |
| 12  | `//`  | Repeat attack (sawtooth up) |
| 13  | `/‾`  | One-shot attack, hold at maximum |
| 14  | `/\/\`| Alternate up/down (triangle) |
| 15  | `/_`  | One-shot attack, hold at zero |

### `AYChannel` type

```ts
type AYChannel = 'A' | 'B' | 'C'
```

### `AYNote` interface

```ts
interface AYNote {
  freq:          number   // Hz — 0 = rest
  dur:           number   // milliseconds
  vol?:          number   // 0–15 (default 15). Ignored when envShape is set.
  noise?:        boolean  // mix LFSR noise alongside tone (default false)
  noisePeriod?:  number   // 1–31 — higher = darker texture (default 8)
  envShape?:     number   // 0–15 (R13) — activates envelope, overrides vol
  envCycleDurMs?: number  // ms for one ramp (15→0 or 0→15). Default = note duration.
}
```

### `AYChip` interface

The handle returned by `createAY()`.

```ts
interface AYChip {
  tone(ch: AYChannel, freq: number, vol?: number): void
  enableNoise(ch: AYChannel, period?: number): void
  disableNoise(ch: AYChannel): void
  envelope(ch: AYChannel, shape: number, cycleDurMs: number): void
  mute(ch: AYChannel): void
  muteAll(): void
  stop(): void
}
```

### `createAY(): AYChip`

Creates three persistent AY channels wired to the master gain. Each channel has:
- An independent square-wave oscillator (tone)
- An LFSR noise path (shared 17-bit noise source, per-channel lowpass filter and gain)
- `AudioParam` automation for envelope

Must be called inside a user-gesture handler.

```ts
button.addEventListener('click', () => {
  initAudio()
  const ay = createAY()

  // Simple tone
  ay.tone('A', 440, 12)           // channel A: A4, amplitude level 12

  // Tone + noise mix
  ay.tone('B', 220, 10)
  ay.enableNoise('B', 16)         // darker noise (higher period = lower cutoff)

  // Envelope — shape 10 = \/\/ triangle, 400ms cycle
  ay.tone('C', 110, 0)            // oscillator active but tone gain is silent
  ay.envelope('C', 10, 400)       // envelope drives the amplitude

  setTimeout(() => ay.muteAll(), 3000)
  setTimeout(() => ay.stop(), 3500)
})
```

#### `ay.tone(ch, freq, vol?)`

Sets the channel oscillator frequency and amplitude. `freq ≤ 0` silences the tone generator (noise can still run). `vol` maps to `AY_VOL` (0–15, default 15). Cancels any running envelope on that channel.

#### `ay.enableNoise(ch, period?)`

Enables LFSR noise on a channel. `period` 1–31 maps to `AY_CLOCK / (16 × period)` Hz as a lowpass cutoff on the noise path. Default period 8 → ~13 kHz (bright, crispy). Period 28 → ~4 kHz (darker, rumble-like).

#### `ay.disableNoise(ch)`

Fades noise out on a channel with a 5ms release.

#### `ay.envelope(ch, shape, cycleDurMs)`

Applies an AY hardware envelope to a channel's amplitude. `shape` 0–15 corresponds to the 16 R13 values. `cycleDurMs` is the duration of one ramp (0→15 or 15→0). Repeating shapes (8, 10, 12, 14) are pre-scheduled for 32 cycles; call again to extend.

```ts
// Explosion: channel C, shape 8 (repeat decay), 60ms per cycle
ay.enableNoise('C', 5)
ay.envelope('C', 8, 60)

// Organ: shape 13 (/‾ fast attack, hold high), 20ms attack
ay.tone('A', 523, 0)
ay.envelope('A', 13, 20)
```

#### `ay.mute(ch)` / `ay.muteAll()`

Fade out one or all channels (5ms release). Cancels any pending envelope automation.

#### `ay.stop()`

Stops all oscillators and the noise source, disconnects all Web Audio nodes. Call when discarding the chip instance.

---

### `playAY(pattern, startDelay?): void`

Pre-schedules up to three independent note arrays on the shared `AudioContext`. All channels start at the same wall-clock time. Fire-and-forget — no handle returned. Per-note noise and envelope are fully supported.

```ts
// Three-channel chiptune jingle with envelope and noise
playAY({
  a: [
    { freq: 523, dur: 300, envShape: 13, envCycleDurMs: 20 },  // C5, organ attack
    { freq: 659, dur: 300, envShape: 13, envCycleDurMs: 20 },  // E5
    { freq: 784, dur: 600, envShape: 12, envCycleDurMs: 100 }, // G5, sawtooth swell
  ],
  b: [
    { freq: 261, dur: 600, vol: 10 },   // C4 bass note
    { freq: 329, dur: 600, vol: 10 },   // E4
  ],
  c: [
    { freq: 0, dur: 100, noise: true, noisePeriod: 5, envShape: 8, envCycleDurMs: 40 },  // snare hit
    { freq: 0, dur: 1100 },  // silence
  ],
})

// With a 500ms startup delay
playAY({ a: melody, b: bass }, 500)
```

---

## `renderer.ts` — Canvas Renderer

All drawing functions operate in **game pixels**. `setupCanvas` applies `ctx.scale(scale, scale)` so every call uses the ZX Spectrum's native coordinate space. Every ink/paper parameter is `SpectrumColor` — the compiler enforces the palette.

### `setupCanvas(canvas, scale, width?, height?): CanvasRenderingContext2D`

One-call canvas initialization. Sets dimensions, CSS size, disables smoothing, applies scale transform.

- `scale` — CSS pixels per game pixel. `4` = standard ZX display (256×192 → 1024×768)
- `width` — game pixels wide, default `256`
- `height` — game pixels tall, default `192`

```ts
const ctx = setupCanvas(canvas, 4)            // standard 256×192
const ctx = setupCanvas(canvas, 4, 256, 208)  // +2 extra rows for status bar
const ctx = setupCanvas(canvas, 3)            // 768×576 CSS — smaller screen
```

### `mirrorSprite(src): Uint8Array`

Flips an 8-byte sprite horizontally. Returns a new `Uint8Array` — the original is not modified. The result is cache-friendly: call once and store both orientations.

```ts
export const PLAYER_RIGHT = new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x24, 0x66])
export const PLAYER_LEFT  = mirrorSprite(PLAYER_RIGHT)
```

### `drawSprite(ctx, sprite, x, y, ink, paper): void`

Draws an 8×8 bitmap at game coordinates. Always paints the `paper` background first. `ink` and `paper` must be `SpectrumColor` values.

```ts
drawSprite(ctx, MINE_SPRITE, col * CELL, row * CELL, C.B_RED,   C.BLACK)
drawSprite(ctx, GEM_SPRITE,  col * CELL, row * CELL, C.B_CYAN,  C.BLACK)
drawSprite(ctx, DOOR_SPRITE, col * CELL, row * CELL, C.YELLOW,  C.B_BLUE)
```

### `drawChar(ctx, charCode, x, y, ink, paper?): void`

Draws one ASCII character from the ROM font. Omit `paper` for a transparent background (only ink pixels are drawn).

```ts
drawChar(ctx, 127, x, y, C.B_GREEN, C.BLACK)        // solid block █
drawChar(ctx, 'A'.charCodeAt(0), x, y, C.B_WHITE)   // transparent bg
```

### `drawText(ctx, text, x, y, ink, paper?): void`

Draws a string left-to-right, one character per `CELL`-wide slot.

```ts
drawText(ctx, 'SCORE:00000', 0, statusY, C.B_WHITE, C.BLACK)
drawText(ctx, 'PRESS ANY KEY', x, y, C.B_YELLOW)  // transparent bg
```

### `drawTextCentered(ctx, text, y, cols, ink, paper?): void`

Centers a string within `cols` character columns.

```ts
// Bind the column count once to keep call sites clean
const print = (text: string, y: number, ink: SpectrumColor) =>
  drawTextCentered(ctx, text, y, 32, ink)

print('GAME  OVER', 88,  C.B_RED)
print('PRESS ANY KEY', 104, C.B_WHITE)
```

### `flashBorder(color, times, intervalMs, resetColor?): void`

Animates `document.body.style.backgroundColor`. Fire-and-forget — does not block. Each call cancels any in-flight flash (no overlapping intervals). Always resets to `resetColor` when the sequence completes.

- `resetColor` defaults to `C.BLACK`

```ts
flashBorder(C.B_RED,   3, 150)              // 3 red flashes → black (explosion)
flashBorder(C.B_GREEN, 2, 200)              // level complete
flashBorder(C.B_CYAN,  2, 120, C.B_BLUE)   // flash → reset to blue border
```

### `drawScanlines(ctx, width?, height?, alpha?): void`

Draws a CRT scanline overlay. Every even row gets a semi-transparent black stripe. Pass the same `width`/`height` as `setupCanvas`, or omit to use the defaults (256×192).

```ts
// At the end of each frame, after all game content:
drawScanlines(ctx)              // standard 256×192, alpha=0.18
drawScanlines(ctx, 256, 208)    // taller canvas
drawScanlines(ctx, 256, 192, 0.25)  // darker scanlines
```

### `curveDisplay(ctx, width?, height?, strength?): void`

Applies a CRT barrel-distortion warp to the canvas content using a temporary off-screen canvas and a `quadraticCurveTo` warp. Gives the display a subtle CRT monitor feel.

```ts
// Last step, after drawScanlines:
curveDisplay(ctx)               // default strength
curveDisplay(ctx, 256, 208, 6)  // stronger warp
```

---

## `audio.ts` — Beeper Audio

Single-channel 1-bit square-wave audio, faithful to the ZX Spectrum beeper. Use this for simple SFX and monophonic melodies. For music with harmony, noise, and envelopes, use `ay.ts`.

All audio routes through a shared `AudioContext` and master `GainNode`. **`initAudio()` must be called inside a user-gesture handler** due to browser autoplay policy.

### `initAudio(volume?): void`

Creates the `AudioContext` and master gain node. Idempotent — safe to call multiple times. `volume` is clamped to 0.0–1.0 (default `0.3`).

```ts
window.addEventListener('keydown', () => initAudio(), { once: true })
window.addEventListener('click',   () => initAudio(), { once: true })
```

### `resumeAudio(): void`

Resumes a suspended `AudioContext`. Browsers suspend the context on tab hide or first load. Call before scheduling any audio in the game loop.

### `getAudioContext(): AudioContext | null`

Returns the shared context, or `null` before `initAudio()`.

### `getMasterGain(): GainNode | null`

Returns the master gain node. Connect custom oscillators here to participate in the global volume level.

### `getMasterVolume(): number`

Returns the current master volume (0.0–1.0), or `0` before `initAudio()`.

### `setMasterVolume(volume): void`

Sets master volume. Clamped to 0.0–1.0. No-op before `initAudio()`.

```ts
setMasterVolume(0.5)  // 50%
setMasterVolume(0)    // mute
setMasterVolume(1)    // full
```

### `increaseVolume() / decreaseVolume(): void`

Adjusts master volume by ±0.1, clamped to 0.0–1.0.

### `Note` interface

```ts
interface Note {
  freq: number  // Hz — 0 = rest (silence, advances timeline)
  dur:  number  // ms
}
```

### `playPattern(notes, startDelay?): void`

Schedules a note sequence on the shared `AudioContext`. `freq: 0` entries produce silence for their duration. `startDelay` offsets the entire pattern in milliseconds.

```ts
// Rising arpeggio
playPattern([
  { freq: 262, dur: 80 },   // C4
  { freq: 330, dur: 80 },   // E4
  { freq: 392, dur: 80 },   // G4
  { freq: 523, dur: 160 },  // C5
])

// With rest and startup delay
playPattern([
  { freq: 880, dur: 100 },
  { freq: 0,   dur: 50  },  // rest
  { freq: 880, dur: 100 },
], 200)
```

### `beep(freq, durationMs, startTime): void`

Schedules a single square-wave note at an absolute `AudioContext.currentTime`. Uses a 5ms linear ramp on attack and release to avoid click artefacts. Use `playPattern` for sequences; use `beep` when you need algorithmic or sample-accurate timing.

```ts
const audio = getAudioContext()!
resumeAudio()
beep(440, 80, audio.currentTime)
beep(880, 80, audio.currentTime + 0.15)  // 150ms later
```

---

## `ui.ts` — UI Widgets

High-level drawing helpers and a stateful widget system for HUD elements. All primitives operate in game pixels and enforce the Spectrum palette.

### Types

#### `BorderOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Set `false` to suppress border without removing the object |
| `thickness` | `number` | `1` | Border thickness in game pixels |
| `color` | `SpectrumColor` | parent ink | Overrides the parent function's foreground color |
| `style` | `'solid' \| 'dashed'` | `'solid'` | `'dashed'` = 2 px on / 2 px off |

#### `DrawProgressBarOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | `"${x},${y}"` | Stable key for managed redraws |
| `x` | `number` | — | Left edge in game pixels |
| `y` | `number` | — | Top edge in game pixels |
| `width` | `number` | — | Total width (multiples of `CELL = 8` recommended) |
| `value` | `number` | — | Current value |
| `min` | `number` | `0` | Empty-edge value |
| `max` | `number` | `1` | Full-edge value |
| `ink` | `SpectrumColor` | `C.B_WHITE` | Filled-block color |
| `paper` | `SpectrumColor` | `C.BLACK` | Empty-block background |
| `border` | `BorderOptions` | — | Optional border |
| `visibilityLength` | `number` | `500` | Ms to stay visible after last call; `0` = permanent |

### Stateless primitives

#### `drawBox(ctx, options): void`

Fills a rectangle with `paper` and draws an optional border.

```ts
drawBox(ctx, {
  x: 8, y: 8, width: 112, height: 40,
  paper: C.BLACK, ink: C.B_WHITE,
  border: { style: 'solid', thickness: 1 },
})
```

#### `drawFrame(ctx, options): void`

Draws a border only — no background fill.

```ts
drawFrame(ctx, { x: 0, y: 0, width: 256, height: 176, color: C.B_CYAN })
drawFrame(ctx, { x: 16, y: 16, width: 64, height: 32, color: C.B_RED,
  border: { style: 'dashed' } })
```

#### `drawPanelTitle(ctx, options): void`

Renders a text strip (`CELL + padding * 2` height) with optional background fill. Does not draw a surrounding container — combine with `drawBox` or `drawFrame`.

```ts
drawBox(ctx, { x: 8, y: 24, width: 128, height: 56, paper: C.BLACK })
drawPanelTitle(ctx, {
  text: 'OPTIONS', x: 8, y: 24,
  ink: C.B_YELLOW, paper: C.BLACK,
  centered: true, width: 128,
})
```

### Stateful widget — Progress Bar

The progress bar is a **managed widget**: after a `drawProgressBar` call, the bar is automatically re-rendered on subsequent frames by `renderUI` until `visibilityLength` milliseconds have elapsed. Calling `drawProgressBar` again resets the timer.

#### `drawProgressBar(ctx, options): void`

Draws the bar immediately **and** registers it for managed redraws.

```ts
// Appears for 1.5 s after each volume change
drawProgressBar(ctx, {
  id: 'volume', x: 88, y: 88, width: 80,
  value: getMasterVolume(),
  ink: C.B_GREEN, paper: C.BLACK,
  border: { style: 'solid' },
  visibilityLength: 1500,
})

// Permanent HUD element (visibilityLength: 0)
drawProgressBar(ctx, {
  id: 'health', x: 0, y: 184, width: 40,
  value: lives, min: 0, max: 3,
  ink: C.B_GREEN, paper: C.BLACK,
  visibilityLength: 0,
})
```

#### `tickUI(dtMs): void`

Advances all managed bar timers. Expired bars are removed. Call once per frame.

#### `renderUI(ctx): void`

Redraws all currently visible bars. Call every frame **after** the game world render.

#### `resetUI(): void`

Clears all managed widget state. Call alongside `resetInput()` on phase transitions.

```ts
// Typical game loop
renderFrame(ctx, state)
tickUI(dt)
renderUI(ctx)

// Phase transition
resetInput()
resetUI()
appPhase = 'intro'
```

---

## `input.ts` — Keyboard Input

Handles directional movement with configurable key-repeat (immediate on first press, configurable auto-repeat delay on hold) plus single-consume flags for action keys. Call `initInput()` once at startup, then `tickMovement(dt)` every frame.

### `Direction` type

```ts
type Direction = 'up' | 'down' | 'left' | 'right'
```

### `initInput(repeatDelay?, repeatInterval?): void`

Attaches `keydown`/`keyup` listeners. Idempotent — safe to call multiple times; timing parameters are always updated but listeners are only registered once.

Default key bindings: arrows = movement, `W A S D` = also movement, `F` = flag action, `P` = pause, `Ctrl+Shift+B` = debug toggle.

```ts
initInput()          // default: 150ms initial delay, 80ms repeat
initInput(200, 60)   // custom timing
```

### `tickMovement(dtMs): Direction | null`

Returns the active movement direction for this frame, or `null`. Handles the delay/repeat state machine internally. Call exactly once per frame.

```ts
const dir = tickMovement(dt)
if (dir === 'left')  player.x -= speed * dt
if (dir === 'right') player.x += speed * dt
if (dir === 'up')    player.y -= speed * dt
if (dir === 'down')  player.y += speed * dt
```

### Consume flags

Each function returns `true` exactly once per key press, then resets to `false`. Designed for single-fire events — menus, flags, pause, etc.

| Function | Default key | Typical use |
|----------|-------------|-------------|
| `consumeFlag()` | `F` | Flag / unflag a tile |
| `consumePause()` | `P` | Pause / unpause |
| `consumeDebug()` | `Ctrl+Shift+B` | Toggle debug overlay |
| `consumeAnyKey()` | Any key | Dismiss overlays, start game |

```ts
if (consumeFlag())   toggleFlag(playerX, playerY)
if (consumePause())  appPhase = appPhase === 'paused' ? 'game' : 'paused'
if (consumeAnyKey()) appPhase = 'game'  // dismiss title screen
```

### `isHeld(key): boolean`

Returns whether a key is currently held down. Argument is `KeyboardEvent.key`.

```ts
if (isHeld('ArrowUp') && isHeld('ArrowRight')) moveDiagonal()
```

### `resetInput(): void`

Clears all pending key state immediately — held keys, direction, all consume flags. Call on phase transitions to prevent stale inputs carrying over.

```ts
appPhase = 'gameover'
resetInput()   // discard any queued keypresses from gameplay
```

---

## `sprite.ts` — Free-Roaming Sprites

Sprites are entities that move in continuous pixel space — not locked to the 8×8 tile grid. Use them for players, enemies, bullets, particles: anything with physics or sub-pixel movement. They integrate directly with `collision.ts` for tile-map wall resolution.

### `Sprite` interface

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `x` | `number` | `0` | Horizontal position in game pixels (float allowed) |
| `y` | `number` | `0` | Vertical position in game pixels |
| `vx` | `number` | `0` | Horizontal velocity in px/ms |
| `vy` | `number` | `0` | Vertical velocity in px/ms |
| `bitmap` | `Uint8Array` | — | 8-byte sprite bitmap |
| `ink` | `SpectrumColor` | — | Foreground color |
| `paper` | `SpectrumColor \| null` | `null` | Background color, or `null` for transparent |
| `flipX` | `boolean` | `false` | Render mirrored horizontally (cached — no per-frame allocation) |
| `visible` | `boolean` | `true` | When `false`, `renderSprite` skips this entity |

### `createSprite(bitmap, ink, paper?): Sprite`

Creates a `Sprite` at `(0, 0)` with zero velocity. `paper` defaults to `null` (transparent).

```ts
const PLAYER_BM = new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x24, 0x66])
const BULLET_BM = new Uint8Array([0x00, 0x00, 0x18, 0x3C, 0x18, 0x00, 0x00, 0x00])

const player = createSprite(PLAYER_BM, C.B_CYAN)           // transparent bg
const bullet = createSprite(BULLET_BM, C.B_YELLOW, C.BLACK) // opaque bg
player.x = 16; player.y = 80
```

### `moveSprite(sprite, dt): void`

Advances `sprite.x` by `vx * dt` and `sprite.y` by `vy * dt`. Call once per frame, before collision resolution.

### `applyGravity(sprite, gravity, dt): void`

Adds `gravity * dt` to `sprite.vy`. Call once per frame, before `moveSprite`.

- `gravity` in px/ms² — typical values: `0.002`–`0.005` (platformer), `0.008` (debris)

```ts
applyGravity(player, 0.003, dt)
moveSprite(player, dt)
// then resolveX / resolveY...
```

### `renderSprite(ctx, sprite): void`

Draws the sprite at `(Math.round(x), Math.round(y))`. Skips if `visible === false`. Respects `flipX` (uses cached mirrored bitmap) and `paper: null` (transparent — only ink pixels painted).

```ts
player.flipX = player.vx < 0  // face the direction of movement
renderSprite(ctx, player)
```

---

## `collision.ts` — AABB Collision

Axis-aligned bounding box overlap tests and sprite-vs-tile-map wall resolution.

### `Rect` interface

```ts
interface Rect { x: number; y: number; w: number; h: number }
```

### `spriteRect(sprite): Rect`

Returns the `CELL × CELL` bounding box of a sprite at its current position.

### `rectsOverlap(a, b): boolean`

Returns `true` when two rectangles share at least one pixel. Touching edges return `false`.

```ts
rectsOverlap(spriteRect(bullet), spriteRect(enemy))  // hit test
```

### `spritesOverlap(a, b): boolean`

Shorthand: `rectsOverlap(spriteRect(a), spriteRect(b))`.

```ts
if (spritesOverlap(player, coin)) collectCoin()
if (enemies.some(e => spritesOverlap(player, e))) loseLife()
```

### `isSolidAt(map, px, py): boolean`

Tests whether the game-pixel `(px, py)` falls inside a solid tile. Out-of-bounds pixels return `true` (implicit solid boundary).

### `resolveX(sprite, map, newX): { x, hitLeft, hitRight }`

Resolves a proposed horizontal move against solid tiles. Returns the clamped position and directional hit flags. No collision → returns `newX` unchanged.

```ts
const { x, hitLeft, hitRight } = resolveX(player, map, player.x)
player.x = x
if (hitLeft || hitRight) player.vx = 0
```

### `resolveY(sprite, map, newY): { y, hitTop, hitBottom }`

Resolves a proposed vertical move against solid tiles.

- `hitBottom` — landed on a floor (use for jump ground detection)
- `hitTop` — bumped a ceiling

```ts
const { y, hitBottom, hitTop } = resolveY(player, map, player.y)
player.y = y
if (hitBottom) { player.vy = 0; onGround = true }
if (hitTop)    { player.vy = 0 }
```

---

## `animation.ts` — Frame Timer & Tween

Two small primitives for time-based animation:

- **`Animation`** — counts time and reports the current frame index of an N-frame strip. Holds no bitmaps; index lookup into your sprite table is your job (so one timer can drive multi-direction sprites).
- **`Tween`** — interpolates a 2D position from `(fromX, fromY)` to `(toX, toY)` over a duration with optional easing. Useful for sliding a sprite between cells, dropping a mine in an arc, etc.

Both are stateful objects you mutate via tick functions — same shape as `Sprite` + `moveSprite`. Neither uses module-level state, so multiple instances coexist freely.

### `Easing` type & `Easings`

```ts
type Easing = (t: number) => number     // 0..1 → eased value

Easings.linear      // (t) => t                    — constant velocity
Easings.easeIn      // (t) => t * t                — quadratic in (slow start)
Easings.easeOut     // (t) => 1 - (1-t) * (1-t)    — quadratic out (slow end)
```

Pass any `(t: number) => number` to `createTween({ ease })` to roll your own.

### `Animation` interface

```ts
interface Animation {
  frameCount: number          // number of frames in cycle
  frameMs: number             // duration of each frame
  loop: boolean               // wrap, or stop on last frame
  elapsed: number             // accumulated time (internal)
  done: boolean               // true once non-looping anim reaches the end
  onComplete?: () => void     // fired exactly once (non-looping only)
}
```

### `createAnimation(frameCount, frameMs, opts?): Animation`

```ts
const walkAnim = createAnimation(2, 60)                                // 2-frame walk cycle
const explosion = createAnimation(4, 50, {
  loop: false,
  onComplete: () => state.phase = 'gameover',
})
```

### `tickAnimation(anim, dt): number`

Advances by `dt` ms, returns the current frame index (`0..frameCount-1`). For non-looping animations, fires `onComplete` exactly once when the last frame ends.

```ts
const idx = tickAnimation(walkAnim, dt)
const sprite = PLAYER_FRAMES[playerDir][idx]   // your own lookup table
drawSprite(ctx, sprite, x, y, C.B_WHITE, C.BLACK)
```

### `getAnimationFrame(anim): number`

Reads the current frame index without advancing time — useful when reading inside a renderer that runs after the tick.

### `resetAnimation(anim): void`

Returns the animation to frame 0 and clears `done`. Use to restart a non-looping animation, or to begin a fresh loop from frame 0.

### `Tween` interface

```ts
interface Tween {
  fromX, fromY, toX, toY: number
  durationMs: number
  elapsed: number             // accumulated time (internal)
  x, y: number                // current interpolated position (read after tickTween)
  ease: Easing
  done: boolean
  onComplete?: () => void
}
```

### `createTween(fromX, fromY, toX, toY, durationMs, opts?): Tween`

```ts
// Slide player from one cell to the next over 120ms
state.walkTween = createTween(
  state.playerCol * 8, state.playerRow * 8,
  newCol * 8, newRow * 8,
  120,
  { onComplete: () => commitMove(state) },
)
```

### `tickTween(tween, dt): boolean`

Advances by `dt` ms, updates `tween.x` / `tween.y`, returns `true` once the tween has reached its end. Fires `onComplete` exactly once. Subsequent calls after completion are no-ops.

```ts
if (state.walkTween) {
  tickTween(state.walkTween, dt)
  // renderer reads state.walkTween.x / .y
}
```

### Combining Animation + Tween

Typical walk-between-cells pattern: a looping `Animation` cycles the foot frames while a non-looping `Tween` slides the position. They tick independently — the tween decides *where*, the animation decides *which sprite*.

```ts
// On input:
state.walkTween = createTween(/* from cell, to cell, 120ms */, {
  onComplete: () => commitMove(state),
})

// In game loop:
if (state.walkTween) {
  tickAnimation(state.walkAnim, dt)
  tickTween(state.walkTween, dt)
}

// In renderer:
const px = state.walkTween ? state.walkTween.x : state.playerCol * CELL
const py = state.walkTween ? state.walkTween.y : state.playerRow * CELL
const f = getAnimationFrame(state.walkAnim)
drawSprite(ctx, PLAYER_FRAMES[state.playerDir][f], Math.round(px), Math.round(py), ink, paper)
```

### `Blinker` — on/off toggle timer

A minimal boolean timer that flips its state every `intervalMs`. Use for blinking text ("PRESS ANY KEY"), flashing warnings, cursor visibility, aircraft alerts — any situation where a boolean needs to alternate on a fixed cadence.

#### `Blinker` interface

```ts
interface Blinker {
  intervalMs: number   // toggle interval in ms
  elapsed: number      // internal: accumulated time since last toggle
  state: boolean       // current state — true = on, false = off
}
```

#### `createBlinker(intervalMs, opts?): Blinker`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `opts.initialState` | `boolean` | `true` | Starting state — `true` = visible |

```ts
const blinker = createBlinker(500)                          // toggle every 500 ms
const cursor  = createBlinker(400, { initialState: false }) // starts hidden
```

#### `tickBlinker(blinker, dt): boolean`

Advances the blinker by `dt` ms and returns the current state. Handles accumulated time correctly — if `dt` spans multiple intervals the state flips the appropriate number of times with the remainder carried over.

```ts
// Module-level setup (once):
const blinker = createBlinker(BLINK_INTERVAL_MS)

// In game loop (replaces manual timer + toggle):
const blink = tickBlinker(blinker, dt)
renderIntro(ctx, blink)
state.blink = blink
```

---

## `camera.ts` — Scrolling Camera

A 2D viewport that maps a window of world space onto the screen. The camera follows a target point (typically the player) with frame-rate-independent smoothing and an optional deadzone, and clamps to world bounds so the viewport never sees outside the map.

```ts
import { createCamera, setCameraTarget, tickCamera, worldToScreen, isInView } from 'zx-kit'

const cam = createCamera({
  viewW: 256, viewH: 192,        // game canvas size
  worldW: 2048, worldH: 192,     // a long horizontal level
  lerp: 0.15,                    // smooth follow (15% of remaining distance per 16.67 ms)
  deadzoneW: 64, deadzoneH: 0,   // ±32 px horizontal slack before the camera scrolls
})

// In your game loop:
setCameraTarget(cam, player.x, player.y)
tickCamera(cam, dt)

// Render anything via worldToScreen — sprites stay aligned to the camera:
for (const e of enemies) {
  if (!isInView(cam, e.x, e.y, 8, 8)) continue   // cull off-screen
  const s = worldToScreen(cam, e.x, e.y)
  drawSprite(ctx, ENEMY, s.x, s.y, C.B_RED, C.BLACK)
}
```

### `Camera` interface

| Field | Description |
|-------|-------------|
| `x`, `y` | Current viewport top-left in world pixels (mutated by `tickCamera`) |
| `viewW`, `viewH` | Viewport size in pixels |
| `worldW`, `worldH` | World size in pixels — camera clamps so `x ∈ [0, worldW-viewW]` |
| `lerp` | `(0..1]` — fraction of remaining distance covered per 60 fps frame. `1` = snap. |
| `deadzoneW`, `deadzoneH` | Deadzone size — target may move ±`deadzoneW/2` from centre before scrolling |
| `targetX`, `targetY` | Current follow target (set via `setCameraTarget`) |

### `createCamera(opts): Camera`

Creates a camera at world origin `(0, 0)`. `lerp` defaults to `1` (snap), deadzones default to `0`.

### `setCameraTarget(cam, x, y): void`

Sets the world-space follow target. Does not move the camera — `tickCamera` does that.

### `tickCamera(cam, dt): void`

Advances the camera one frame:
1. Computes the desired viewport position from the target, honouring the deadzone
2. Eases `cam.x` / `cam.y` toward the desired position using `lerp` (frame-rate-corrected by `dt`)
3. Clamps to world bounds so the viewport never sees outside the world

The lerp is dt-independent: one `tickCamera(cam, 33.34)` call produces (within floating-point precision) the same result as two `tickCamera(cam, 16.67)` calls. If the world is smaller than the viewport the camera pins to `(0, 0)`.

### `worldToScreen(cam, wx, wy): { x, y }`

Converts a world coordinate to a screen (viewport-relative) coordinate. Subtracts `cam.x` / `cam.y`.

### `isInView(cam, wx, wy, w?, h?): boolean`

Returns `true` when a world rectangle of size `w × h` (default `0 × 0` for a point test) overlaps the camera viewport. Use to cull off-screen sprites before drawing.

---

## `scene.ts` — Scene Manager

A stack-based scene manager with full lifecycle hooks. Replaces ad-hoc phase enums (`'intro' | 'playing' | 'gameover'`) with a clean push / pop / replace API. Only the **top** scene receives `update`, so pushing a pause overlay freezes everything beneath; **all** scenes receive `render` bottom-up, so the paused scene stays visible.

```ts
import { createSceneManager, pushScene, popScene, updateScenes, renderScenes, type Scene } from 'zx-kit'

const gameplay: Scene = {
  name: 'gameplay',
  update(dt) { /* tick game */ },
  render(ctx) { /* draw game */ },
  onPause() { stopAmbientSound() },
  onResume() { startAmbientSound() },
}

const pauseOverlay: Scene = {
  name: 'pause',
  update(_dt) { if (keys.pressed('P')) popScene(mgr) },
  render(ctx) { drawTextCentered(ctx, '** PAUSED **', ROWS/2 * CELL, C.B_WHITE, C.BLACK) },
}

const mgr = createSceneManager()
pushScene(mgr, gameplay)        // gameplay.onEnter(null)
// later, player presses P:
pushScene(mgr, pauseOverlay)    // gameplay.onPause() → pauseOverlay.onEnter(gameplay)

// Game loop:
updateScenes(mgr, dt)           // only top scene ticks
renderScenes(mgr, ctx)          // bottom-up: gameplay first, then pause overlay
```

### `Scene` interface

| Field | Description |
|-------|-------------|
| `name` | Human-readable identifier (for logging / debugging) |
| `update(dt)` | Called once per frame on the **top** scene only |
| `render(ctx)` | Called once per frame on **all** scenes, bottom-up |
| `onEnter?(prev)` | Fired when this scene becomes top (push / replace / initial). `prev` is the previously-top scene or `null`. |
| `onExit?(next)` | Fired when this scene is removed (pop / replace). `next` is what becomes top, or `null`. |
| `onPause?()` | Fired when another scene is pushed on top of this one. |
| `onResume?()` | Fired when the scene above this one is popped. |

### `createSceneManager(): SceneManager`

Creates a manager with an empty stack.

### `pushScene(mgr, scene): void`

Pushes a scene onto the stack. Lifecycle order: `prev.onPause()` → `scene.onEnter(prev)`. Use for modal overlays, dialogs, pause screens.

### `popScene(mgr): Scene | null`

Pops the top scene and returns it (or `null` if the stack was empty). Lifecycle order: `top.onExit(below)` → `below.onResume()`.

### `replaceScene(mgr, scene): void`

Swaps the top scene without affecting scenes beneath. Lifecycle order: `outgoing.onExit(scene)` → `scene.onEnter(outgoing)`. Does **not** fire `onPause` / `onResume` on the scene below — it was never paused by this call. Use for state transitions like `gameplay → gameOver` while keeping `intro` on the bottom.

On an empty manager `replaceScene` behaves like `pushScene` (outgoing is `null`).

### `currentScene(mgr): Scene | null`

Returns the top scene, or `null` if the stack is empty.

### `updateScenes(mgr, dt): void`

Updates the top scene only. No-op on an empty manager. Scenes beneath the top stay frozen — this is what makes pause overlays work.

### `renderScenes(mgr, ctx): void`

Renders every scene from bottom to top. No-op on an empty manager.

---

## `tilemap.ts` — Tile Map Engine

A scrollable, queryable tile map backed by an O(1) id-index. Tiles use the same 8×8 sprite format as `drawSprite`. Supports solid-tile collision queries, viewport-clipped rendering, and smart seasonal background swapping.

### Types

#### `Tile`

| Field | Type | Description |
|-------|------|-------------|
| `sprite` | `Uint8Array` | 8-byte bitmap |
| `ink` | `SpectrumColor` | Foreground color |
| `paper` | `SpectrumColor` | Background color |
| `solid` | `boolean` | `true` = blocks movement |
| `id` | `string \| number` | Stable identifier for logic and swap operations |
| `metadata?` | `Record<string, unknown>` | Optional game payload (points, next level, …) |

#### `Viewport`

| Field | Type | Description |
|-------|------|-------------|
| `x` | `number` | First visible column (tile units) |
| `y` | `number` | First visible row (tile units) |
| `cols` | `number` | Number of columns to render |
| `rows` | `number` | Number of rows to render |

### `createTileMap(cols, rows): TileMap`

Creates an empty `cols × rows` map — all cells start `null`.

### Method reference

| Method | Description |
|--------|-------------|
| `setTile(x, y, tile)` | Store a shallow copy. Out-of-bounds = silent no-op. |
| `getTile(x, y)` | Return tile or `null`. Never throws. |
| `clearTile(x, y)` | Remove tile (collect gem, break wall). |
| `fill(tile)` | Fill every cell with independent shallow copies. |
| `fillRect(x, y, w, h, tile)` | Fill rectangle; clips to map bounds. |
| `setBackground(tile)` | Register or swap the background (see below). |
| `render(ctx, viewport?)` | Render map or viewport via `drawSprite`. Empty cells skipped. |
| `isSolid(x, y)` | `true` if tile is solid or position is out-of-bounds. |
| `findById(id)` | `{ x, y, tile }[]` for all tiles with given `id` — O(1). |

### Smart background swapping (`setBackground`)

- **First call** — registers the tile as the current background. Map is not modified; call `fill` first to place tiles.
- **Subsequent calls** — replaces every cell whose `id` still matches the previous background with the new tile. Cells with any other `id` (player, gems, modified terrain) are untouched.

```ts
map.fill(TILE_GRASS)
map.setBackground(TILE_GRASS)   // register

map.setTile(5, 3, TILE_PLAYER)  // player placed on grass

map.setBackground(TILE_SNOW)    // grass → snow; player tile untouched
map.setBackground(TILE_NIGHT)   // snow → night; player still safe
```

---

## `palette.ts` — Color Constants

### `SCALE`

Default CSS-pixel scale factor: `4`. One game pixel = 4×4 CSS pixels at standard Spectrum resolution.

### `CELL`

Tile and character grid size: `8` game pixels. Matches the ZX Spectrum's 8×8 character cell.

### `C` — Color object

| Key | Hex | Key | Hex |
|-----|-----|-----|-----|
| `C.BLACK` | `#000000` | `C.B_BLACK` | `#000000` |
| `C.BLUE` | `#0000CD` | `C.B_BLUE` | `#0000FF` |
| `C.RED` | `#CD0000` | `C.B_RED` | `#FF0000` |
| `C.MAGENTA` | `#CD00CD` | `C.B_MAGENTA` | `#FF00FF` |
| `C.GREEN` | `#00CD00` | `C.B_GREEN` | `#00FF00` |
| `C.CYAN` | `#00CDCD` | `C.B_CYAN` | `#00FFFF` |
| `C.YELLOW` | `#CDCD00` | `C.B_YELLOW` | `#FFFF00` |
| `C.WHITE` | `#CDCDCD` | `C.B_WHITE` | `#FFFFFF` |

### `SpectrumColor` type

```ts
type SpectrumColor = typeof C[keyof typeof C]
```

A union of all hex string values in `C`. Enforces palette compliance at compile time — any function that accepts `SpectrumColor` will reject an arbitrary `string` at the type level.

---

## `font.ts` — ROM Bitmap Font

96 printable ASCII characters (codes 32–127), each 8×8 pixels, byte-for-byte faithful to the original ZX Spectrum ROM. Character 127 is a solid block `█`.

### `FONT`

```ts
const FONT: Uint8Array  // 768 bytes: 96 chars × 8 rows
// Row bitmap: FONT[(charCode - 32) * 8 + row]
// Bit layout: bit 7 = leftmost pixel
```

### `getCharRow(charCode, row): number`

Returns the bitmap byte for one row of a character. `charCode` outside 32–127 returns `0`. `row` outside 0–7 returns `0`. In practice, use `drawChar`/`drawText` from `renderer.ts` — you only need `getCharRow` for custom pixel-level font rendering.

```ts
// Draw a character manually
for (let row = 0; row < 8; row++) {
  const byte = getCharRow('A'.charCodeAt(0), row)
  for (let bit = 0; bit < 8; bit++) {
    if (byte & (0x80 >> bit)) ctx.fillRect(x + bit, y + row, 1, 1)
  }
}
```

---

## Architecture

### Module structure

```
zx-kit/
├── package.json           # exports: { ".": "./dist/index.js" }, sideEffects: false
├── tsconfig.json          # strict, emits to dist/
├── README.md
├── src/
│   ├── index.ts           # barrel — re-exports everything
│   ├── palette.ts         # SCALE, CELL, C, SpectrumColor
│   ├── font.ts            # FONT, getCharRow
│   ├── renderer.ts        # setupCanvas, mirrorSprite, drawSprite, drawChar,
│   │                      # drawText, drawTextCentered, flashBorder,
│   │                      # drawScanlines, curveDisplay
│   ├── audio.ts           # initAudio, resumeAudio, beep, playPattern,
│   │                      # getAudioContext, getMasterGain,
│   │                      # getMasterVolume, setMasterVolume,
│   │                      # increaseVolume, decreaseVolume, Note
│   ├── ay.ts              # createAY, playAY, AYChannel, AYNote, AYChip,
│   │                      # AY_VOL, AY_CLOCK, AY_ENVELOPE_SHAPES
│   ├── input.ts           # initInput, tickMovement, consumeFlag,
│   │                      # consumePause, consumeDebug, consumeAnyKey,
│   │                      # isHeld, resetInput, Direction
│   ├── ui.ts              # drawBox, drawFrame, drawPanelTitle,
│   │                      # drawProgressBar, tickUI, renderUI, resetUI,
│   │                      # BorderOptions, DrawProgressBarOptions
│   ├── tilemap.ts         # createTileMap, Tile, Viewport, TileMap
│   ├── sprite.ts          # createSprite, moveSprite, applyGravity,
│   │                      # renderSprite, Sprite
│   └── collision.ts       # spriteRect, rectsOverlap, spritesOverlap,
│                          # isSolidAt, resolveX, resolveY, Rect
└── dist/                  # compiled output (npm run build)
    ├── index.js
    ├── index.d.ts
    └── ...
```

### Design decisions

**No runtime dependencies.** Every module uses only Web platform APIs — `CanvasRenderingContext2D`, `AudioContext`, `KeyboardEvent`. There is nothing to install, no transitive vulnerabilities, no version drift from third-party packages.

**Singleton state.** `audio.ts`, `ay.ts`, and `input.ts` hold module-level state. This is intentional: a game has one audio context, one input handler. It is not suitable for multiple independent game instances on the same page.

**Compiled distribution.** The package ships compiled JS + `.d.ts` to `dist/`. Any bundler (Vite, webpack, esbuild, Rollup) consumes it without aliases or configuration.

**`sideEffects: false`.** All module-level initialisation is lazy — no DOM access, no event listeners, no network calls at import time. Bundlers can tree-shake any module whose exports are not used. Import only `playAY` and `createAY` and the beeper, input, and UI modules are completely excluded from your production bundle.

**ZX Spectrum authenticity.** The palette values, cell size (`CELL = 8`), and font bytes are constants, not configuration. The `SpectrumColor` type enforces the palette at the TypeScript level — you cannot accidentally pass an arbitrary hex string where a palette color is expected.

**AY clock accuracy.** `AY_CLOCK = 1_773_400 Hz` and `AY_VOL[]` are measured values from the real AY-3-8912 chip. The LFSR noise buffer uses the correct 17-bit polynomial (`bit = (lfsr ^ (lfsr >> 2)) & 1`). The logarithmic amplitude table uses the real chip's ≈ √2 step factor (3 dB per level).

---

## License

MIT — see [LICENSE](LICENSE).

---

*zx-kit is extracted from [Minefield](https://github.com/zrebec/minefield), a ZX Spectrum-style minesweeper game.*
