# API reference

The gameplay and utility modules: input, sprites, animation, camera, scenes, tile maps, UI widgets, particles, seeded RNG, locale selection, and presentation helpers. Rendering, audio, collision, and save have their own guides: [rendering](rendering.md) · [audio](audio.md) · [collision](collision.md) · [save](save.md).

## `input.ts` — Keyboard & Gamepad Input

Handles directional movement with configurable keyboard repeat, transparent
gamepad polling, and single-consume flags for action buttons. Call
`initInput()` once at startup, then `tickMovement(dt)` every frame.

### `Direction` type

```ts
type Direction = 'up' | 'down' | 'left' | 'right'
```

### `initInput(repeatDelay?, repeatInterval?): void`

Attaches `keydown`/`keyup` listeners. Idempotent — safe to call multiple times; timing parameters are always updated but listeners are only registered once.

Default key bindings: arrows = movement, `W A S D` = also movement, `F` = flag action, `P` = pause, `Ctrl+Shift+B` = debug toggle.

Gamepad support is automatic. `tickMovement()` polls the first connected
gamepad via the browser Gamepad API: D-pad / left stick move, button 0 maps to
`consumeFlag()`, button 9 maps to `consumePause()`, button 3 maps to
`consumeDebug()`, and any button triggers `consumeAnyKey()`.

```ts
initInput()          // default: 150ms initial delay, 80ms repeat
initInput(200, 60)   // custom timing
```

### `tickMovement(dtMs): Direction | null`

Returns the active movement direction for this frame, or `null`. Handles the
keyboard delay/repeat state machine and gamepad polling internally. Call
exactly once per frame.

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
| `consumeFlag()` | `F` / gamepad button 0 | Flag / unflag a tile |
| `consumePause()` | `P` / gamepad button 9 | Pause / unpause |
| `consumeDebug()` | `Ctrl+Shift+B` / gamepad button 3 | Toggle debug overlay |
| `consumeAnyKey()` | Any key / any gamepad button | Dismiss overlays, start game |

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

### `CameraOptions` interface

Options passed to `createCamera()`. `viewW`, `viewH`, `worldW`, and `worldH`
are required; `lerp`, `deadzoneW`, and `deadzoneH` are optional.

```ts
interface CameraOptions {
  viewW: number
  viewH: number
  worldW: number
  worldH: number
  lerp?: number
  deadzoneW?: number
  deadzoneH?: number
}
```

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

Options type: `DrawDottedGridOptions`.

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

Options type: `DrawSegmentedBarOptions`.

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

Options type: `DrawTankOptions`.

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

Options type: `DrawDialOptions`.

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

Options type: `DrawCompassTextOptions`.

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

## `particles.ts` — Particle Pool

An **allocation-free** particle pool for ZX-style pixel effects: carrot-shot sparks, landing dust, an enemy curling into a puff, glowing motes around a crystal. The pool is created once at startup with a fixed capacity; emitting and ticking never allocate, so it is safe to run every frame. Particles are plain coloured squares drawn in the Spectrum palette. Pass an `rng` for deterministic effects (replays, seeded worlds); otherwise it uses `Math.random`.

### `Particle` / `ParticleSystem` interfaces

```ts
interface Particle {
  x: number; y: number          // world pixels
  vx: number; vy: number        // px per ms
  life: number; maxLife: number // ms (fade with life / maxLife)
  color: SpectrumColor
  size: number                  // square side in px
  active: boolean               // false slots are free for reuse
}

interface ParticleSystem {
  readonly particles: Particle[]   // length === capacity
  readonly capacity: number
  activeCount: number
}
```

### `Ranged` type

Several emitter options accept either a fixed value or a `[min, max]` range.

```ts
type Ranged = number | readonly [number, number]
```

### `createParticleSystem(capacity): ParticleSystem`

Creates a pool of `capacity` particles, all inactive. Throws when `capacity` is not a positive integer.

### `emitParticles(ps, opts): number`

Emits up to `opts.count` particles and returns the number actually emitted
(fewer when the pool is full). Throws when `count` is negative or non-integer.
The options object is exported as `EmitOptions`.

| Option | Type | Default | Meaning |
|--------|------|---------|---------|
| `x`, `y` | `number` | — | spawn position (world px) |
| `count` | `number` | — | how many to emit |
| `color` | `SpectrumColor \| SpectrumColor[]` | — | single colour, or palette to pick per particle |
| `speed` | `number \| [min, max]` | `0.03` | px/ms |
| `angle` | `number` | `0` | base direction in radians (`-π/2` = up) |
| `spread` | `number` | `0` | angular jitter centred on `angle` |
| `life` | `number \| [min, max]` | `300` | lifetime in ms |
| `size` | `number` | `1` | square side in px |
| `rng` | `() => number` | `Math.random` | deterministic source |

```ts
const sparks = createParticleSystem(128)

// on carrot impact — a fan of yellow/white sparks shooting upward
emitParticles(sparks, {
  x: hit.x, y: hit.y, count: 12,
  color: [C.B_YELLOW, C.B_WHITE],
  speed: [0.02, 0.06], angle: -Math.PI / 2, spread: Math.PI,
  life: [200, 400],
})
```

### `tickParticles(ps, dtMs, gravity?): void`

Advances every active particle by `dtMs`, applying optional `gravity` (px/ms², default `0`) to vertical velocity. Expired particles are deactivated and returned to the pool.

### `renderParticles(ctx, ps, offsetX?, offsetY?): void`

Draws every active particle as a filled square, rounding world coordinates to whole pixels. Subtract the camera world position via `offsetX` / `offsetY` to convert world → screen.

### `clearParticles(ps): void`

Deactivates all particles immediately (e.g. on room change).

```ts
// game loop
tickParticles(sparks, dt, 0.0004)            // gentle gravity
renderParticles(ctx, sparks, cam.x, cam.y)   // scrolled world
```

---

## `rng.ts` — Seeded RNG

A **seeded deterministic** pseudo-random generator: the same seed produces the same sequence on every machine and every run — exactly what procedural worlds need. Built on **mulberry32** (fast, allocation-free, good statistical quality for games). It is **not** cryptographically secure.

The call order is part of the determinism contract: call the methods in the same order to reproduce a world.

### `createRng(seed): Rng`

Creates a generator from a `string` (hashed via `hashSeed`) or a finite `number` (coerced to uint32). Throws on a non-finite numeric seed.

### `Rng` methods

| Method | Returns | Throws when |
|--------|---------|-------------|
| `next()` | float `[0, 1)` | — |
| `int(maxExclusive)` | int `[0, max)` | `max` not a positive integer |
| `range(min, max)` | int `[min, max)` | bounds non-integer, or `max <= min` |
| `float(min, max)` | float `[min, max)` | `max < min` |
| `chance(p)` | boolean (`true` ~`p`) | `p` outside `[0, 1]` |
| `pick(items)` | random element | `items` empty |
| `shuffle(items)` | same array, shuffled in place | — |
| `fork()` | independent `Rng` (advances parent one step) | — |

```ts
const rng = createRng('cave-level-7')
const roomCount = rng.range(3, 7)
const theme     = rng.pick(['spider', 'centipede', 'crystal'])
if (rng.chance(0.15)) placeSecret()

// independent sub-streams so adding enemies doesn't shift terrain layout
const terrainRng = rng.fork()
const enemyRng   = rng.fork()
```

### `hashSeed(seed): number`

Hashes a string to an unsigned 32-bit integer (FNV-1a). Deterministic; exported for keying sub-streams by name.

---

## `i18n.ts` — Runtime Locale Selection

A tiny helper for choosing a translated string pack at runtime. The original ZX Spectrum could not realistically swap whole languages while a game was running; zx-kit keeps the Spectrum presentation, but lets browser games offer modern language switching without a framework or dependency.

### `pickLocale(defaultLocale, locales, code): T`

Selects a locale object by language code and falls back to the default locale when the code is missing, empty, or unknown. Matching is case-insensitive.

```ts
import { pickLocale } from 'zx-kit'
import * as en from './strings'
import * as sk from './strings.sk'
import * as ru from './strings.ru'

let languageCode = localStorage.getItem('language')  // e.g. 'sk'
let L = pickLocale(en, { sk, ru }, languageCode)

drawText(ctx, L.STR_PRESS_START, 32, 88, C.B_WHITE, C.BLACK)

function setLanguage(code: string): void {
  languageCode = code
  localStorage.setItem('language', code)
  L = pickLocale(en, { sk, ru }, languageCode)
}
```

Every locale must have the same shape as the default locale. Because `pickLocale` is generic over that shape, missing keys and wrong function signatures are caught by TypeScript:

```ts
// strings.ts
export const STR_PRESS_START = 'PRESS START'
export const STR_DEPTH = (m: number) => `D:${m}M`

// strings.sk.ts
export const STR_PRESS_START = 'STLAC START'
export const STR_DEPTH = (m: number) => `H:${m}M`
```

Selection rules:

| Code | Result |
|------|--------|
| `null`, `undefined`, `''` | `defaultLocale` |
| `'sk'`, `'SK'`, `'Sk'` | `locales.sk` |
| unknown code | `defaultLocale` |
| `'en'` when `en` is not in `locales` | `defaultLocale` |

The default language does not need its own `strings.en.ts` file. Keep the source language at `strings.ts`, put only additional translations in the locale map, and call `pickLocale` again whenever the player changes language.

---


## `presentation.ts` — Title & Loading Helpers

Small, stateless helpers for title screens and tape-loading flourishes. Call them from your
render loop — they hold no state of their own.

- `blinkVisible(now, intervalMs = 500): boolean` — phase of a blink cycle; `true` for the visible
  half. Drives flashing "PRESS ANY KEY" prompts without per-frame bookkeeping.
- `drawBlinkingText(...)` — convenience wrapper that draws text only while `blinkVisible` is true.
- `drawTapeStripes(ctx, opts: TapeStripesOptions)` — the coloured ZX tape-loading border stripes.
- `drawMenuOptions(ctx, config: MenuOptionsConfig)` — renders a vertical menu option list.

See `src/presentation.ts` for exact signatures and the `TapeStripesOptions` / `MenuOptionsConfig` fields.

## `debug.ts` — Debug Overlay

A tiny frame-timing monitor and a Spectrum-style FPS/CPU overlay. The kit owns the *measurement*;
the game owns the toggle key and placement. Only what a 2D-canvas browser game can honestly measure
— frame pacing and JS main-thread work. **No VRAM or GPU figure** (not observable from Canvas2D),
and `cpuLoad` is the JS update+render cost, not the GPU blit. Resolution, JS heap, and draw-call
counters are planned for later slices.

- `createDebugMonitor(opts?): DebugMonitor` — `opts.targetFps` (default `60`), `opts.smoothing`
  (EMA factor 0..1, default `0.1`).
- `beginFrame(m, now?)` — call at the top of the loop; updates `frameMs` and the smoothed `fps`,
  and starts the work clock. `now` defaults to `performance.now()` (pass the rAF timestamp).
- `endFrame(m, now?)` — call after update+render; sets `workMs`. Optional — skip it and
  `workMs`/`cpuLoad` stay `0`.
- `sampleDebug(m, custom?): DebugInfo` — read the numbers; merge game fields via `custom`
  (e.g. `{ mines: 12 }`).
- `drawDebugOverlay(ctx, info, x?, y?, ink?, paper?)` — draws `FPS` + frame ms, a `CPU %` line
  (only when work time was measured), then one line per `custom` field. Defaults `x=1, y=1`,
  `ink=C.B_YELLOW`, `paper=C.BLACK`.

`DebugInfo` = `{ fps, frameMs, workMs, budgetMs, cpuLoad, custom }`.

```ts
const dbg = createDebugMonitor({ targetFps: 60 })
let showDebug = false
addEventListener('keydown', e => { if (e.key === 'F3') showDebug = !showDebug })

function loop(now: number) {
  beginFrame(dbg, now)
  update(dt); render(ctx)
  endFrame(dbg)
  if (showDebug) drawDebugOverlay(ctx, sampleDebug(dbg, { mines: mineCount }))
  requestAnimationFrame(loop)
}
```
