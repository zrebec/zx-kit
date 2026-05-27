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
- **Three-tier collision** — AABB overlap tests, generic rect-vs-tile wall resolution (any sprite size), and pixel-precise mask overlap with O(pixels) sorted-merge intersection — no allocations per frame
- **Keyboard input** — configurable key-repeat, single-consume action flags, instant state reset on phase transitions
- **ZX-style UI widgets** — progress bars with managed lifetime, boxes, frames, panel titles
- **Typed save / load** — persistent saves via `localStorage` with schema versioning, migrations, slot enumeration, in-memory throttling, and discriminated Result types for every failure mode
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

## Getting Started — Build Your First Game

This tutorial walks you through building a working game from scratch: a character you can move around the screen with arrow keys, animated walking frames, and a sound effect on every step.

No prior game development experience needed. You need basic JavaScript/TypeScript knowledge (variables, functions, arrays).

---

### What you will need

| Tool | Where to get it | Why |
|------|----------------|-----|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) | Runs npm — the package manager we use to install zx-kit |
| **A code editor** | [code.visualstudio.com](https://code.visualstudio.com) (free) | Edits your source files |
| **A terminal** | Built into macOS/Linux; use PowerShell on Windows | Runs commands |

---

### Step 1 — Create the project

Open a terminal and run:

```bash
mkdir my-first-game
cd my-first-game
npm init -y
```

`npm init -y` creates a `package.json` file — the project's identity card. The `-y` flag accepts all defaults so you don't have to answer questions.

---

### Step 2 — Install dependencies

```bash
npm install zx-kit
npm install --save-dev vite
```

- **zx-kit** — the game engine you are building with
- **vite** — a development server that reloads the browser whenever you save a file (installed as a dev tool, not part of your shipped game)

---

### Step 3 — Configure package.json

Open `package.json` and replace it with the following. The two key additions are `"type": "module"` (enables modern JavaScript imports) and the `scripts` section (adds the `npm run dev` command):

```json
{
  "name": "my-first-game",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "zx-kit": "^0.15.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

---

### Step 4 — Create index.html

Create a file called `index.html` in your project root:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My First Game</title>
    <style>
      body {
        margin: 0;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

The `<canvas>` is the game screen. The `<script>` tag loads your game code.

---

### Step 5 — Create the game

Create the folder `src/` and inside it a file called `main.ts`. We will build it one piece at a time.

---

#### 5a — Canvas setup

A canvas element is just a rectangle of pixels in the browser. `setupCanvas` configures it for pixel-perfect ZX Spectrum-style rendering and returns a drawing context you use to paint everything.

```ts
import { setupCanvas, C, CELL } from 'zx-kit'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = setupCanvas(canvas, 4)
// The screen is 256 × 192 game pixels, scaled up 4× in the browser.
// From here on draw everything in game pixels — setupCanvas handles the scale.
```

`C` is the color palette. `CELL` is the size of one sprite: 8 pixels.

---

#### 5b — Define a sprite

Every character and object in zx-kit is an 8×8 pixel bitmap. You define it as 8 numbers, one per row. Each number is 8 bits — one bit per pixel. Bit 7 is the leftmost pixel.

The binary literal `0b00111100` is the same as the number `60`, but written out as ones and zeros so you can see the pixel pattern directly.

We will use two walking frames so the character animates when it moves:

```ts
//                     76543210  ← bit position (7 = leftmost pixel)
const WALK_A = new Uint8Array([
  0b00111100,  //  ..####..   head
  0b01111110,  //  .######.
  0b00011000,  //  ...##...   neck
  0b01111110,  //  .######.   arms + body
  0b00011000,  //  ...##...   waist
  0b01011010,  //  .#.##.#.   legs apart
  0b01000010,  //  .#....#.   feet
  0b00000000,  //  ........
])

const WALK_B = new Uint8Array([
  0b00111100,  //  ..####..   head
  0b01111110,  //  .######.
  0b00011000,  //  ...##...   neck
  0b01111110,  //  .######.   arms + body
  0b00011000,  //  ...##...   waist
  0b00111100,  //  ..####..   legs together
  0b00011000,  //  ...##...
  0b00000000,  //  ........
])

const FRAMES = [WALK_A, WALK_B]  // frame 0 = legs apart, frame 1 = legs together
```

---

#### 5c — Input

`initInput()` attaches keyboard listeners. Call it once at startup, not inside the game loop.

`isHeld(key)` returns `true` while a key is pressed. We use it to check whether an arrow key is being held down each frame.

```ts
import { initInput, isHeld } from 'zx-kit'

initInput()
```

---

#### 5d — Audio

Browsers will not play any sound until the user has interacted with the page (clicked, tapped, or pressed a key). This is a browser security rule — there is nothing we can do to bypass it. The pattern below waits for the first keydown and initialises audio then:

```ts
import { initAudio, getAudioContext, resumeAudio, beep } from 'zx-kit'

window.addEventListener('keydown', () => initAudio(0.3), { once: true })
// initAudio(0.3) = master volume 30%.  Called at most once thanks to { once: true }.
```

---

#### 5e — Player state and animation

```ts
import { createAnimation, tickAnimation } from 'zx-kit'

let px = 120       // player x position in game pixels
let py = 88        // player y position
const SPEED = 60   // pixels per second

// A 2-frame looping animation, 150ms per frame = one full step every 300ms
const walkAnim = createAnimation(2, 150)
let stepTimer = 0  // footstep sound timer
```

---

#### 5f — The game loop

Every frame the browser calls `loop`. Inside, we:

1. Calculate `dt` — how many milliseconds passed since last frame
2. Move the player based on held keys
3. Keep the player inside the screen
4. Pick the right animation frame
5. Play a footstep sound periodically while moving
6. Clear the screen and redraw everything

```ts
import { drawSprite, drawText } from 'zx-kit'

let lastTime = 0

function loop(now: number): void {
  const dt = Math.min(now - lastTime, 100)
  // dt is milliseconds since the last frame (usually ~16ms at 60fps).
  // We cap at 100ms so a background tab returning doesn't cause a huge position jump.
  lastTime = now

  // ── Move player ────────────────────────────────────────────────────────────
  let moving = false
  if (isHeld('ArrowRight')) { px += SPEED * dt / 1000; moving = true }
  if (isHeld('ArrowLeft'))  { px -= SPEED * dt / 1000; moving = true }
  if (isHeld('ArrowDown'))  { py += SPEED * dt / 1000; moving = true }
  if (isHeld('ArrowUp'))    { py -= SPEED * dt / 1000; moving = true }
  // SPEED (60) is pixels per second. dt is milliseconds. Divide by 1000 to convert.

  // Keep inside the 256×192 canvas
  px = Math.max(0, Math.min(256 - CELL, px))
  py = Math.max(0, Math.min(192 - CELL, py))

  // ── Animation ──────────────────────────────────────────────────────────────
  // tickAnimation advances the timer and returns the current frame index (0 or 1).
  // When standing still we always use frame 0.
  const frame = moving ? tickAnimation(walkAnim, dt) : 0

  // ── Footstep sound ─────────────────────────────────────────────────────────
  if (moving) {
    stepTimer -= dt
    if (stepTimer <= 0) {
      stepTimer = 250  // play a sound every 250ms while moving
      const audio = getAudioContext()
      if (audio) {
        resumeAudio()                       // un-suspend if the tab was hidden
        beep(220, 30, audio.currentTime)    // 220 Hz, 30ms — a short thud
      }
    }
  } else {
    stepTimer = 0  // reset so next movement starts immediately
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, 256, 192)  // clear the whole screen

  drawSprite(ctx, FRAMES[frame], Math.round(px), Math.round(py), C.B_CYAN, C.BLACK)
  //                              ↑ position      ↑ ink color     ↑ paper (background)

  drawText(ctx, 'ARROW KEYS = MOVE', 8, 184, C.WHITE)
  // drawText draws one ASCII character per 8px slot, left-to-right.

  requestAnimationFrame(loop)  // ask the browser to call us again next frame
}

requestAnimationFrame(loop)   // kick off the first frame
```

---

### Step 6 — Run the game

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Press an arrow key. Your character walks.

---

### Complete file

The full `src/main.ts` all in one place:

```ts
import {
  setupCanvas, C, CELL,
  drawSprite, drawText,
  initInput, isHeld,
  initAudio, getAudioContext, resumeAudio, beep,
  createAnimation, tickAnimation,
} from 'zx-kit'

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = setupCanvas(canvas, 4)

// ── Sprites ───────────────────────────────────────────────────────────────────
const WALK_A = new Uint8Array([
  0b00111100,  //  ..####..   head
  0b01111110,  //  .######.
  0b00011000,  //  ...##...   neck
  0b01111110,  //  .######.   arms + body
  0b00011000,  //  ...##...   waist
  0b01011010,  //  .#.##.#.   legs apart
  0b01000010,  //  .#....#.   feet
  0b00000000,  //  ........
])

const WALK_B = new Uint8Array([
  0b00111100,  //  ..####..   head
  0b01111110,  //  .######.
  0b00011000,  //  ...##...   neck
  0b01111110,  //  .######.   arms + body
  0b00011000,  //  ...##...   waist
  0b00111100,  //  ..####..   legs together
  0b00011000,  //  ...##...
  0b00000000,  //  ........
])

const FRAMES = [WALK_A, WALK_B]

// ── Input ─────────────────────────────────────────────────────────────────────
initInput()

// ── Audio ─────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', () => initAudio(0.3), { once: true })

// ── Player state ──────────────────────────────────────────────────────────────
let px = 120
let py = 88
const SPEED = 60  // pixels per second

const walkAnim = createAnimation(2, 150)
let stepTimer = 0

// ── Game loop ─────────────────────────────────────────────────────────────────
let lastTime = 0

function loop(now: number): void {
  const dt = Math.min(now - lastTime, 100)
  lastTime = now

  let moving = false
  if (isHeld('ArrowRight')) { px += SPEED * dt / 1000; moving = true }
  if (isHeld('ArrowLeft'))  { px -= SPEED * dt / 1000; moving = true }
  if (isHeld('ArrowDown'))  { py += SPEED * dt / 1000; moving = true }
  if (isHeld('ArrowUp'))    { py -= SPEED * dt / 1000; moving = true }

  px = Math.max(0, Math.min(256 - CELL, px))
  py = Math.max(0, Math.min(192 - CELL, py))

  const frame = moving ? tickAnimation(walkAnim, dt) : 0

  if (moving) {
    stepTimer -= dt
    if (stepTimer <= 0) {
      stepTimer = 250
      const audio = getAudioContext()
      if (audio) { resumeAudio(); beep(220, 30, audio.currentTime) }
    }
  } else {
    stepTimer = 0
  }

  ctx.fillStyle = C.BLACK
  ctx.fillRect(0, 0, 256, 192)

  drawSprite(ctx, FRAMES[frame], Math.round(px), Math.round(py), C.B_CYAN, C.BLACK)
  drawText(ctx, 'ARROW KEYS = MOVE', 8, 184, C.WHITE)

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
```

---

### What to try next

**Change the sprite.** Edit the binary rows in `WALK_A` / `WALK_B` — each `1` is a pixel, each `0` is background. Draw a spaceship, a gem, or a face.

**Change the color.** Replace `C.B_CYAN` with any palette color: `C.B_GREEN`, `C.B_YELLOW`, `C.B_RED`, `C.B_MAGENTA`, `C.B_WHITE`. The full list is in the [palette reference](#palettets--color-constants).

**Add a second character.** Copy the player variables (`px2`, `py2`, `walkAnim2`) and add `W A S D` controls using `isHeld('w')` etc.

**Add obstacles.** Use `createTileMap` to place solid wall tiles and `resolveX` / `resolveY` to stop the player at them.

**Add chiptune music.** Call `playAY()` with a note array to play a three-channel melody — see [`ay.ts`](#ayts--ay-3-8912-melodik-audio).

**Study a complete game.** [Minefield](https://github.com/zrebec/minefield) is built entirely with zx-kit. Every mechanic in this tutorial — sprites, input, animation, audio, tilemap — appears there in a production context.

---

## Modules

| Module | What it provides |
|--------|-----------------|
| [`ay.ts`](#ayts--ay-3-8912-melodik-audio) | AY chip emulator: 3-channel tone, LFSR noise, 16 envelope shapes |
| [`renderer.ts`](#rendererts--canvas-renderer) | Canvas setup, sprites, text, scanlines, border flash |
| [`audio.ts`](#audiots--beeper-audio) | 1-bit beeper: square-wave notes, patterns, volume control |
| [`ui.ts`](#uits--ui-widgets) | Boxes, frames, panel titles, progress bars + instrumentation widgets (dotted grids, segmented bars, fluid tanks, dials, text compass) |
| [`input.ts`](#inputts--keyboard-input) | Movement with key-repeat, action flags, state reset |
| [`sprite.ts`](#spritets--free-roaming-sprites) | Sprites: position, velocity, gravity, flip, render |
| [`collision.ts`](#collisionts--collision-detection) | AABB overlap + rect-based tile resolution, pixel-precise mask overlap and tile checks |
| [`animation.ts`](#animationts--frame-timer--tween) | Frame-timer for sprite strips, position tween between two points |
| [`camera.ts`](#camerats--scrolling-camera) | Viewport that follows a target with lerp + deadzone, world-bounds clamping |
| [`scene.ts`](#scenets--scene-manager) | Stack-based scene manager with onEnter/onExit/onPause/onResume hooks |
| [`save.ts`](#savets--typed-save--load) | Typed save/load via callbacks, versioning + migrations, slot enumeration, throttling, Result types |
| [`tilemap.ts`](#tilemapts--tile-map-engine) | Scrollable maps, solid tiles, O(1) id-index, background swap |
| [`palette.ts`](#palettets--color-constants) | 15 Spectrum colors, `SpectrumColor` type, `CELL`, `SCALE` |
| [`font.ts`](#fontts--rom-bitmap-font) | 96-character ROM font, raw bitmap access |

---

## Audio architecture — beeper vs AY

zx-kit ships two independent audio modules — [`audio.ts`](#audiots--beeper-audio) (the **beeper**) and [`ay.ts`](#ayts--ay-3-8912-melodik-audio) (the **AY chip**). They are **not alternatives** — most ZX Spectrum 128K games used both at once, and so should yours.

### The history (so the choice makes sense)

| Hardware | Beeper (1-bit) | AY-3-8912 (3 ch) |
|----------|:--:|:--:|
| Spectrum 48K | ✅ built-in | ❌ |
| Spectrum 128K / +2 / +3 | ✅ built-in | ✅ built-in |
| Melodik add-on (for 48K) | — | ✅ |

- **48K games** (Manic Miner, Jet Set Willy, Atic Atac) had only the beeper — every blip, jump, footstep and title jingle was a square wave forced out of the 1-bit speaker by tight CPU loops.
- **128K games** (Robocop, R-Type, Chase H.Q., Lord of the Rings) used the AY for **music** — proper 3-channel tunes with envelope shaping — while the beeper kept doing **sound effects** in parallel. AY hummed an orchestral score; the beeper still went *pew pew*.

### When to use which

| Want to play… | Module | Function | Why |
|---|---|---|---|
| Short SFX (shot, jump, hit, beep) | `audio.ts` | `beep(freq, dur, t)` | Single square wave, punchy, era-correct for SFX |
| A 3-channel jingle / chord | `ay.ts` | `playAY({ a, b, c })` | Needs ≥2 simultaneous voices |
| Game-over fanfare / level music | `ay.ts` | `playAY(...)` | Envelope shaping + multiple voices |
| Single-voice melody | `audio.ts` | `playPattern(notes)` | Lighter setup, no AY init needed |
| Live, dynamically-changing tone (siren, engine) | `ay.ts` | `createAY()` then `tone()` | Persistent oscillator handle |
| Title-screen music | `ay.ts` | `playAY(...)` | Authentic 128K title-music feel |

**Rule of thumb:** if it needs to be *heard at the same time as something else*, you almost certainly want AY for at least one of the two.

### Authentic parallel pattern — the "Robocop" pattern

This is how 128K games actually sounded:

```ts
import { initAudio, beep, getAudioContext, resumeAudio } from 'zx-kit'  // beeper
import { playAY }                                          from 'zx-kit'  // AY

// One-time setup (must be inside a user gesture — click, keydown — due to browser autoplay policy)
window.addEventListener('keydown', () => { initAudio(); resumeAudio() }, { once: true })

// Title screen: AY plays a multi-voice melody...
playAY({
  a: [{ freq: 523, dur: 200 }, { freq: 659, dur: 200 }, { freq: 784, dur: 400, envShape: 12, envCycleDurMs: 200 }],
  b: [{ freq: 262, dur: 200 }, { freq: 330, dur: 200 }, { freq: 392, dur: 400 }],
})

// ...meanwhile in the game loop, beeper does the SFX:
function onPlayerShoots() {
  const audio = getAudioContext()
  if (audio) beep(1200, 40, audio.currentTime)     // sharp pew
}
function onPlayerHit() {
  const audio = getAudioContext()
  if (audio) beep(120, 200, audio.currentTime)     // low thump
}
```

Both modules route through the **same master `GainNode`**, so `setMasterVolume(v)` controls both at once. They share state cleanly — no audio bus conflicts.

### Notes on accuracy

- **Beeper** (`audio.ts`) is a faithful 1-bit-style square wave via Web Audio's `OscillatorNode`. Era-correct for SFX use.
- **AY** (`ay.ts`) is a *good approximation* of the AY-3-8912 — hardware-accurate logarithmic amplitudes (16 levels, ≈ √2 ratio), all 16 envelope shapes, proper LFSR noise. **Not sample-accurate**: Web Audio's `OscillatorNode` is band-limited (no aliasing artefacts), real AY's raw squares have a buzzier, fuzzier character; envelopes are smooth ramps here vs the chip's 16-step ramps. For chip-tune purists wanting bit-exact AY emulation, a future AudioWorklet-based backend is on the roadmap. For game sound and most music, the current implementation is more than convincing.

---

## `ay.ts` — AY-3-8912 Melodik Audio

The AY-3-8912 chip (sold as the *Melodik* add-on for ZX Spectrum 48K, built into the 128K) gave the Spectrum three independent square-wave channels, a shared LFSR noise generator, and a hardware envelope generator with 16 distinct shapes. This module emulates all of it via the Web Audio API with hardware-accurate logarithmic amplitude values.

> **Pair with [`audio.ts`](#audiots--beeper-audio) (the beeper) for sound effects.** Use AY for music, beeper for SFX — see [Audio architecture — beeper vs AY](#audio-architecture--beeper-vs-ay) for the historical context and the parallel-use pattern. Both modules share the same master gain, so `setMasterVolume()` controls them together.

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

Single-channel 1-bit square-wave audio, faithful to the ZX Spectrum beeper. Use this for **sound effects** (shots, jumps, hits, beeps) and simple monophonic melodies.

> **Pair with [`ay.ts`](#ayts--ay-3-8912-melodik-audio) for music.** This is how 128K Spectrum games actually sounded — see [Audio architecture — beeper vs AY](#audio-architecture--beeper-vs-ay) for the reasoning and the "Robocop" parallel-use pattern.

All audio routes through a shared `AudioContext` and master `GainNode` — `setMasterVolume()` controls both modules at once. **`initAudio()` must be called inside a user-gesture handler** due to browser autoplay policy.

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

### Instrumentation widgets (stateless)

Five stateless primitives for HUDs, dashboards and tactical displays — gauges, bars, tanks, dials, compass. Each function takes a `ctx` plus an `options` object and renders immediately. The caller drives state on every frame (no built-in animation, no internal timers). Pair with `Animation` / `Tween` from `animation.ts` if you want smoothed transitions.

#### `drawDottedGrid(ctx, options): void`

Regularly-spaced dot pattern. Useful for radar / sonar screens, tactical scanner overlays, debug grids, stippled backgrounds, alien-invasion detection grids.

```ts
// Sonar background (submarine HUD)
drawDottedGrid(ctx, {
  x: 8, y: 8, width: 64, height: 48,
  spacing: 4, color: C.GREEN, paper: C.BLACK,
})

// Chunky 2×2 dots for tactical map overlay
drawDottedGrid(ctx, {
  x: 0, y: 0, width: 256, height: 192,
  spacing: 8, dotSize: 2, color: C.B_WHITE,
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `x`, `y`, `width`, `height` | `number` | — | Area covered by the dot field |
| `spacing` | `number` | — | Distance between adjacent dot centres |
| `color` | `SpectrumColor` | — | Dot colour |
| `paper` | `SpectrumColor` | — | Optional background fill |
| `dotSize` | `number` | `1` | Dot size in pixels (use `2` for chunkier dots) |

#### `drawSegmentedBar(ctx, options): void`

Discrete segmented bar — health, ammo, shield, fuel, stamina, mana, battery, damage. Computes `round(value/max * segments)` filled segments.

Two colouring strategies, mutually exclusive:

- **Single colour** (`color`): every filled segment uses it. Classic Robocop health style.
- **Threshold gradient** (`colors: [low, mid, high]`): the widget picks one of three colours based on `value/max` (`< 1/3` → low, `< 2/3` → mid, else high). Classic oxygen / damage indicator.

```ts
// Robocop-style health (single colour)
drawSegmentedBar(ctx, {
  x: 0, y: 0, segments: 10, value: 7, max: 10,
  color: C.B_GREEN, paper: C.BLACK,
})

// Oxygen with threshold gradient (red → yellow → green)
drawSegmentedBar(ctx, {
  x: 0, y: 0, segments: 10, value: 8, max: 10,
  colors: [C.B_RED, C.B_YELLOW, C.B_GREEN],
  paper: C.BLACK,
})

// Vertical bar (e.g. ammo column on the side of the HUD)
drawSegmentedBar(ctx, {
  x: 0, y: 0, segments: 8, value: 5, max: 8,
  orientation: 'vertical', color: C.B_GREEN,
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `x`, `y` | `number` | — | Top-left corner |
| `segments` | `number` | — | Total segment count |
| `value`, `max` | `number` | — | Filled = `round(value/max * segments)` |
| `segmentWidth` | `number` | `8` (CELL) | Width of one segment |
| `segmentHeight` | `number` | `8` (CELL) | Height of one segment |
| `gap` | `number` | `1` | Pixels between adjacent segments |
| `color` | `SpectrumColor` | — | Single fill colour (mutually exclusive with `colors`) |
| `colors` | `[low, mid, high]` | — | Three-stop threshold gradient |
| `paper` | `SpectrumColor` | — | Background for empty segments |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |

#### `drawTank(ctx, options): void`

Fluid container — ballast tanks, fuel gauges, water reservoirs, lava levels, oil drums, chemical canisters. Liquid fills from the bottom up.

```ts
// Submarine ballast tank (pill, cyan fluid)
drawTank(ctx, {
  x: 8, y: 16, width: 16, height: 48,
  fillPct: 0.66, shape: 'pill',
  liquidColor: C.B_CYAN,
  containerColor: C.WHITE,
  emptyColor: C.BLACK,
})

// Generic fuel gauge (rect, yellow fluid)
drawTank(ctx, {
  x: 200, y: 8, width: 24, height: 32,
  fillPct: 0.4, shape: 'rect',
  liquidColor: C.B_YELLOW,
  containerColor: C.WHITE,
  emptyColor: C.BLACK,
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `x`, `y`, `width`, `height` | `number` | — | Container bounding box |
| `fillPct` | `number` | — | Fill level `0..1`, clamped |
| `shape` | `'pill' \| 'rect'` | `'pill'` | `'pill'` = rounded caps, `'rect'` = sharp corners |
| `liquidColor` | `SpectrumColor` | — | Fluid colour |
| `containerColor` | `SpectrumColor` | `liquidColor` | Outline colour |
| `emptyColor` | `SpectrumColor \| 'transparent'` | `C.BLACK` | Fill for the empty portion. Use `'transparent'` to leave it un-painted (so the underlying frame shows through) |

#### `drawDial(ctx, options): void`

Circular analog gauge with movable needle — RPM, speedometer, fuel, temperature, volume knob. Decorations (face fill, rim outline, tick marks) are optional; the needle alone is the minimum visible output.

```ts
// Submarine motor RPM gauge (range 0–3000)
drawDial(ctx, {
  cx: 128, cy: 100, radius: 24,
  value: 1500, min: 0, max: 3000,
  needleColor: C.B_RED,
  rimColor: C.WHITE,
  tickColor: C.WHITE,
  ticks: 7,
})

// Bare minimum: just the needle
drawDial(ctx, {
  cx: 50, cy: 50, radius: 10,
  value: 75, needleColor: C.B_GREEN,
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cx`, `cy`, `radius` | `number` | — | Centre and radius |
| `value` | `number` | — | Mapped to needle angle |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `100` | Maximum value |
| `startAngle` | `number` (rad) | `3π/4` | Needle angle at `min` (bottom-left default) |
| `endAngle` | `number` (rad) | `9π/4` | Needle angle at `max` (bottom-right, after sweeping CW through top) |
| `needleColor` | `SpectrumColor` | — | Needle colour |
| `faceColor` | `SpectrumColor` | — | Optional filled disc background |
| `rimColor` | `SpectrumColor` | — | Optional circle outline |
| `tickColor` | `SpectrumColor` | — | Optional tick mark colour (requires `ticks`) |
| `ticks` | `number` | `0` | Number of evenly-spaced tick marks |

Angles use canvas convention: `0` = right, `π/2` = down, `π` = left, `3π/2` = up — angles increase **clockwise** because the canvas y-axis points down. Default sweep covers the typical 270° gauge arc through the top.

#### `drawCompassText(ctx, options): void`

Text-based heading indicator in the classic 80s tactical-display style `[W [NW] N [NE] E]` — current direction in the centre, highlighted, with two neighbouring directions on each side. Heading rounds to the nearest 45° step.

```ts
drawCompassText(ctx, {
  x: 0, y: 168,
  heading: 0,                        // N
  color: C.WHITE,
  highlightColor: C.B_YELLOW,
  paper: C.BLACK,
})
// heading=0 → centre is N. Five labels: W, NW, N, NE, E
// → `W [NW] N [NE] E`  — centre "N" in bright yellow, ±1 in brackets,
//                       outer ±2 ("W", "E") rendered plain.
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `x`, `y` | `number` | — | Top-left of the rendered string |
| `heading` | `number` (degrees) | — | `0`/`360` = N, `90` = E, `180` = S, `270` = W (wraps automatically) |
| `color` | `SpectrumColor` | — | Colour for non-current direction labels |
| `highlightColor` | `SpectrumColor` | `color` | Colour for current direction (centre label) |
| `paper` | `SpectrumColor` | — | Optional background behind labels |
| `brackets` | `boolean` | `true` | Wrap **only the ±1 (adjacent) directions** in `[…]`. The centre label and the outer ±2 directions are never bracketed. |

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

## `collision.ts` — Collision Detection

Three tiers of collision detection, from broad-phase to pixel-precise:

| Tier | Functions | Use case |
|------|-----------|----------|
| **AABB** | `rectsOverlap`, `spritesOverlap`, `spriteRect`, `bitmapRect` | Fast broad-phase hit tests |
| **Rect-vs-tile** | `isSolidAt`, `resolveRectX`, `resolveRectY`, `resolveX`, `resolveY` | Wall resolution for any sprite size |
| **Pixel-precise** | `bitmapPixelMask`, `masksOverlap`, `pixelSolidCount` | Exact opaque-pixel overlap tests |

Pick the tier that matches your accuracy need. AABB is O(1) and correct for most cases. Pixel-precise costs O(opaque pixels) but eliminates false positives for non-rectangular sprites.

### `Rect` interface

```ts
interface Rect { x: number; y: number; w: number; h: number }
```

An axis-aligned bounding rectangle in game pixels.

---

### AABB overlap tests

#### `spriteRect(sprite): Rect`

Returns the `CELL × CELL` bounding box of a sprite at its current position.

#### `bitmapRect(bitmap, x, y): Rect`

Returns the bounding box for any `Bitmap` at `(x, y)`. Correct for bitmaps of any size — 16×24, 32×32, 96×128 — not just `CELL × CELL`.

```ts
const heroRect  = bitmapRect(HERO_BMP, hero.x,  hero.y)
const enemyRect = bitmapRect(ENEMY_BMP, enemy.x, enemy.y)
if (rectsOverlap(heroRect, enemyRect)) damage(hero)
```

#### `rectsOverlap(a, b): boolean`

Returns `true` when two rectangles share at least one pixel. Touching edges (zero-area overlap) return `false`.

```ts
rectsOverlap(spriteRect(bullet), spriteRect(enemy))  // hit test
rectsOverlap(bitmapRect(HERO_BMP, hx, hy), bitmapRect(SWORD_BMP, sx, sy))
```

#### `spritesOverlap(a, b): boolean`

Shorthand: `rectsOverlap(spriteRect(a), spriteRect(b))`.

```ts
if (spritesOverlap(player, coin)) collectCoin()
if (enemies.some(e => spritesOverlap(player, e))) loseLife()
```

---

### Rect-vs-tile resolution

#### `isSolidAt(map, px, py): boolean`

Tests whether the game-pixel `(px, py)` falls inside a solid tile. Out-of-bounds pixels return `true` (implicit solid boundary). Converts to tile coords via `Math.floor(px / CELL)`.

```ts
if (isSolidAt(map, player.x, player.y + CELL)) { player.vy = 0 } // on floor
```

#### `resolveRectX(rect, map, newX): { x, hitLeft, hitRight }`

Generic horizontal resolver for any axis-aligned rectangle. Checks every tile row the rectangle spans — so a 16×24 hero correctly detects walls in the middle rows, not just the top and bottom corners.

Returns the clamped x and collision flags. On collision, the rectangle is placed flush against the wall.

```ts
const rect = bitmapRect(HERO_BMP, hero.x, hero.y)
const r = resolveRectX(rect, map, hero.x + dx)
hero.x = r.x
if (r.hitLeft || r.hitRight) hero.vx = 0
```

#### `resolveRectY(rect, map, newY): { y, hitTop, hitBottom }`

Generic vertical resolver for any axis-aligned rectangle. Checks every tile column the rectangle spans — so a wide wagon detects the floor across its full footprint.

```ts
const rect = bitmapRect(HERO_BMP, hero.x, hero.y)
const r = resolveRectY(rect, map, hero.y + dy)
hero.y = r.y
if (r.hitBottom) { hero.vy = 0; onGround = true }
if (r.hitTop)    { hero.vy = 0 }
```

#### `resolveX(sprite, map, newX): { x, hitLeft, hitRight }`

Resolves a proposed horizontal move for an 8×8 sprite. Thin wrapper over `resolveRectX` — preserved for the common CELL-sized sprite case.

```ts
const { x, hitLeft, hitRight } = resolveX(player, map, player.x)
player.x = x
if (hitLeft || hitRight) player.vx = 0
```

#### `resolveY(sprite, map, newY): { y, hitTop, hitBottom }`

Resolves a proposed vertical move for an 8×8 sprite. Thin wrapper over `resolveRectY`.

- `hitBottom` — landed on a floor (use for jump ground detection)
- `hitTop` — bumped a ceiling

```ts
const { y, hitBottom, hitTop } = resolveY(player, map, player.y)
player.y = y
if (hitBottom) { player.vy = 0; onGround = true }
if (hitTop)    { player.vy = 0 }
```

---

### Pixel-precise collision

AABB and rect-vs-tile use the full bounding box. This is almost always correct — but it fails for non-rectangular sprites in edge cases: a circular character standing on a ledge, a diamond-shaped projectile grazing a corner, a tall hero with narrow feet that shouldn't trigger floor detection when hanging over a gap.

Pixel-precise collision solves this by working with the actual opaque pixels of a bitmap, not its enclosing rectangle.

```
AABB (16px wide):     ████████████████   → fires when any part of the box overlaps
                                           a tile, even if the sprite itself clears it
pixelSolidCount:      ···██····██····   → only the real foot pixels are checked —
                                           Dizzy hanging over a platform edge doesn't
                                           feel magically glued to empty air
```

#### `PixelMask` interface

```ts
interface PixelMask {
  readonly width:       number
  readonly height:      number
  readonly rows:        readonly (readonly number[])[]   // per-row sorted opaque column indices
  readonly totalPixels: number
}
```

Pre-computed per-row opaque pixel data for a `Bitmap`. Build once with `bitmapPixelMask`; reuse every frame. Each `rows[r]` is a sorted array of column indices where that row has a set bit. Empty rows have zero-length arrays — never `undefined`.

```
// Example: 16×16 circular sprite
mask.rows[0]  → [6, 7, 8, 9]        // narrow top
mask.rows[7]  → [0, 1, 2, ..., 15]  // full-width middle
mask.rows[11] → [3, 4, 10, 11]      // only feet
mask.rows[14] → []                   // below feet, empty
```

The immutability guarantee matters: the mask is derived from immutable `Bitmap` data. Pre-compute once and store alongside the bitmap definition.

#### `bitmapPixelMask(bitmap): PixelMask`

Extracts a pixel mask from a `Bitmap`. Reads each row's bit data (bit 7 = leftmost pixel) and collects column indices of set (opaque) pixels into sorted arrays. Counts `totalPixels` for overlap severity calculations.

```ts
// Pre-compute at module load time — not inside the game loop
const HERO_MASK   = bitmapPixelMask(HERO_BMP)
const ENEMY_MASK  = bitmapPixelMask(ENEMY_BMP)
const BULLET_MASK = bitmapPixelMask(BULLET_BMP)
```

**Bitmap width must be a multiple of 8.** Bitmaps with width `w` require `w * height / 8` bytes of data — standard `createBitmap` enforces this.

#### `masksOverlap(a, ax, ay, b, bx, by): number`

Counts opaque pixels of mask `a` at `(ax, ay)` that overlap with opaque pixels of mask `b` at `(bx, by)`.

Returns **0** when there is no pixel-level overlap. Any value **> 0** is a pixel-perfect collision. The count itself carries semantic meaning: use it for overlap severity — damage scaling, knock-back strength, or as a threshold to ignore grazing touches.

Uses sorted-merge intersection per row: O(opaque pixels), no allocations per call. Safe to call every frame for multiple pairs.

```ts
// Simple hit test
if (masksOverlap(BULLET_MASK, bullet.x, bullet.y, ENEMY_MASK, enemy.x, enemy.y) > 0) {
  destroyEnemy()
}

// Severity — require a real overlap, not just a 1-pixel graze
const overlap = masksOverlap(SWORD_MASK, sx, sy, HERO_MASK, hx, hy)
if (overlap >= 3) {
  takeDamage(Math.round(overlap / SWORD_MASK.totalPixels * 10))
}
```

Masks of different sizes work without any special handling — the overlap window is clipped to the intersection region automatically.

#### `pixelSolidCount(mask, mx, my, map): number`

Counts opaque pixels of a mask at `(mx, my)` that sit on solid tiles in a `TileMap`. Pixel-precise replacement for AABB-based ground / wall checks.

Solves the "character standing on a platform edge" problem: a round sprite with narrow feet can hang over the edge — only the real foot pixels are checked against the tile map, not the full bounding box.

```ts
const HERO_MASK = bitmapPixelMask(HERO_BMP)

// Check if standing — test 1 px below current foot position
const standing = pixelSolidCount(HERO_MASK, hero.x, hero.y + 1, map) > 0

// Check wall to the right — test 1 px past right edge
const wallRight = pixelSolidCount(HERO_MASK, hero.x + 1, hero.y, map) > 0

// How many foot pixels are actually on solid ground? Use as grip factor
const groundContact = pixelSolidCount(HERO_MASK, hero.x, hero.y + 1, map)
```

When `groundContact` is 0, a circle-shaped hero hanging over a tile edge won't trigger `hitBottom` in `resolveRectY` — the pixel-check and AABB-check intentionally disagree, and you pick which one to trust for each gameplay mechanic.

---

### Choosing the right tier

| Situation | Recommended tier |
|-----------|-----------------|
| Player touches any part of a coin | `spritesOverlap` — AABB is exact when both sprites are `CELL × CELL` |
| Large hero (16×24) walks into a wall | `resolveRectX` / `resolveRectY` — checks all tile rows the sprite spans |
| Round sprite on a platform edge | `pixelSolidCount` — only real foot pixels count |
| Bullet vs. irregular boss sprite | `masksOverlap` — pixel-precise, returns overlap count for damage |
| Off-road detection for a truck with a bumpy silhouette | `pixelSolidCount` / custom mask loop — checks each opaque pixel against road boundary |

For a step-by-step walkthrough of both tiers — including how to combine AABB and pixel-precise in one loop and how to handle non-tile boundaries — see **[docs/collision.md](docs/collision.md)**.

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

## `save.ts` — Typed Save / Load

Persistent save / load via `localStorage` with versioning, schema migration, slot enumeration, and in-memory throttling. The game declares its state shape through `serialize` / `deserialize` callbacks; the kit handles storage, namespacing, error mapping, and throttle timing. Every operation returns a discriminated Result type — `quota`, `disabled`, `corrupt`, `version_unsupported` and the rest are distinct, so the game can react to each failure mode if it cares.

```ts
import {
  createSaveProfile, writeSave, writeSaveThrottled,
  readSave, readSaveLatest, saveExists, deleteSave, listSaves,
} from 'zx-kit'

type MyGameSave = {
  score: number
  lives: number
  probed: string[]   // Set<string> serialized to array
}

const save = createSaveProfile<MyGameSave>({
  key: 'my-game',
  version: 1,
  serialize: () => ({
    score: game.score,
    lives: game.lives,
    probed: [...game.probedCells],
  }),
  deserialize: (data) => {
    game.score = data.score
    game.lives = data.lives
    game.probedCells = new Set(data.probed)
  },
})

writeSave(save, 'manual')                       // immediate write to 'manual'
writeSaveThrottled(save, 'auto', 5000)          // skips if last 'auto' write < 5s ago
readSaveLatest(save)                            // load newest slot, calls deserialize
deleteSave(save, 'auto')                        // remove slot + clear its throttle entry
```

### Why callbacks, not a "save the whole state" snapshot

In emulators a full RAM dump round-trips losslessly because RAM is a byte array. JavaScript state is an object graph: `JSON.stringify(gameState)` silently corrupts `Set`, `Map`, class instances and circular references; a snapshot also persists transient runtime state (audio nodes, `requestAnimationFrame` IDs) that has no business surviving. Forcing the game to declare what's in a save via `serialize` keeps the kit state-agnostic and gives the game a place to convert non-JSON values back and forth.

### `SaveProfileConfig<T>` interface

| Field | Description |
|-------|-------------|
| `key` | Game key — used as namespace in storage. Unique per game. |
| `version` | Current schema version. Increment when the shape of `T` changes. |
| `serialize` | Returns the current game state as a JSON-safe `T`. |
| `deserialize` | Applies a loaded `T` back to the game (side effect — the game owns the mutation). |
| `migrate?` | `(data: unknown, fromVersion: number) => T` — runs when the loaded envelope is older than `version`. If absent and `fromVersion < version`, load fails with `version_unsupported`. |

### `SaveResult` / `LoadResult`

```ts
type SaveResult =
  | { ok: true }
  | { ok: false, reason: 'quota' | 'disabled' | 'serialize_error' | 'throttled', error?: Error }

type LoadResult =
  | { ok: true, slot: string }
  | { ok: false, reason: 'not_found' | 'corrupt' | 'version_unsupported' | 'parse_error' | 'disabled', error?: Error }
```

`throttled` is not a true failure — it means the throttle interval hadn't elapsed and the write was skipped. Surfaced as `ok: false` so callers can distinguish skipping from a real success, but typically ignored.

### `createSaveProfile<T>(config): SaveProfile<T>`

Registers a save profile. Call once at startup and reuse the returned handle for every operation. The handle also carries in-memory throttle state (per-slot last-write timestamps).

### `writeSave(profile, slot?): SaveResult`

Writes immediately. Calls `serialize`, wraps the result as `{ version, timestamp, data }` and stores under `zxkit:<key>:<slot>`. Default slot is `'default'`.

### `writeSaveThrottled(profile, slot, minIntervalMs): SaveResult`

Writes only if at least `minIntervalMs` has elapsed since the last successful write to the same slot in this session. The first call to a given slot always proceeds — the throttle only applies once there's a prior write to compare against. Throttle state lives in memory; a page reload resets it.

### `readSave(profile, slot?): LoadResult`

Reads a slot, runs `migrate` if the stored version is older than the profile version, then calls `deserialize` with the result. On `ok`, the game state has been restored.

### `readSaveLatest(profile): LoadResult`

Enumerates every slot belonging to this profile's key and loads the one with the most recent `timestamp`. Returns `{ ok: false, reason: 'not_found' }` when no slots exist.

### `saveExists(profile, slot?): boolean`

True iff the slot key exists in storage. Does not validate envelope shape — use `readSave` for that.

### `deleteSave(profile, slot?): boolean`

Removes the slot. Also clears the slot's throttle entry, so the next `writeSaveThrottled` to that slot proceeds immediately. Returns `true` if a slot was actually removed.

### `listSaves(profile): SlotInfo[]`

Returns `{ name, timestamp, version, sizeBytes }[]` for every slot belonging to this profile. Corrupt or mis-shaped entries are silently skipped — they will surface as `corrupt` if loaded explicitly via `readSave`.

### Versioning and migration

Every saved payload carries `{ version, timestamp, data }`. On load, when the stored version is older than the profile's current version, `migrate` is called with the raw `data` and the version it was saved at. If the stored version is newer than the profile's, the load fails with `version_unsupported` — a downgrade cannot read forward.

```ts
createSaveProfile({
  key: 'my-game',
  version: 3,
  migrate: (data, fromVersion) => {
    let d = data as Record<string, unknown>
    if (fromVersion < 2) d = { ...d, lives: 3 }       // v1 → v2: gained 'lives'
    if (fromVersion < 3) d = { ...d, probed: [] }     // v2 → v3: gained 'probed'
    return d as MyGameSave
  },
  deserialize: (data) => { /* always receives v3 shape */ },
})
```

If `migrate` throws, the read fails with `corrupt`.

### Slot naming — convention, not policy

The kit places no policy on slot names. A useful pattern for retro-style games:

- `'auto'` — written via `writeSaveThrottled` at meaningful game events (level complete, checkpoint, after a major state change).
- `'manual'` — written via `writeSave` when the player hits a save key.
- Load via `readSaveLatest` to pick whichever is newer.

This composes a "your last meaningful checkpoint is always available" UX without a load-slot menu.

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
│   └── collision.ts       # spriteRect, bitmapRect, rectsOverlap, spritesOverlap,
│                          # isSolidAt, resolveRectX, resolveRectY, resolveX, resolveY,
│                          # bitmapPixelMask, masksOverlap, pixelSolidCount,
│                          # Rect, PixelMask
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
