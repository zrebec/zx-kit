# Getting started — build your first game

A start-to-finish walkthrough: project setup, dependencies, and a complete playable ZX-flavoured game built with zx-kit. New here? Do this first, then dip into the [module reference](api.md), [rendering](rendering.md), and [audio](audio.md) guides.

This tutorial walks you through building a working game from scratch: a character you can move around the screen with arrow keys, animated walking frames, and a sound effect on every step.

No prior game development experience needed. You need basic JavaScript/TypeScript knowledge (variables, functions, arrays).

---

### What you will need

| Tool | Where to get it | Why |
|------|----------------|-----|
| **Node.js 22+** | [nodejs.org](https://nodejs.org) | Runs npm — the package manager we use to install zx-kit |
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
    "zx-kit": "^0.31.1"
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

**Change the color.** Replace `C.B_CYAN` with any palette color: `C.B_GREEN`, `C.B_YELLOW`, `C.B_RED`, `C.B_MAGENTA`, `C.B_WHITE`. The full list is in the [palette reference](rendering.md#palettets--color-constants).

**Add a second character.** Copy the player variables (`px2`, `py2`, `walkAnim2`) and add `W A S D` controls using `isHeld('w')` etc.

**Add obstacles.** Use `createTileMap` to place solid wall tiles and `resolveX` / `resolveY` to stop the player at them.

**Add chiptune music.** Call `playAY()` with a note array to play a three-channel melody — see [`ay.ts`](audio.md#ayts--ay-3-8912-melodik-audio).

**Study a complete game.** [Minefield](https://github.com/zrebec/minefield) is built entirely with zx-kit. Every mechanic in this tutorial — sprites, input, animation, audio, tilemap — appears there in a production context.

---
