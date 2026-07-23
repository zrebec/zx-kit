# Rendering

Everything that draws to the canvas: setup and core draw calls, arbitrary-size bitmaps and attribute maps, the colour-clash and monochrome screen models, the offscreen layer cache, pixel-smooth scrolling, dithered lighting, plus the palette and ROM-font constants.

Sister guides: [audio](audio.md) · [collision](collision.md) · [API reference](api.md).

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

### `drawShade(ctx, x, y, w, h, ink, paper, pattern?): void` · `DITHER`

Fills a `w×h` rectangle with an ordered-**dither shade** of `ink` over `paper` — the classic ZX trick to fake an intermediate tone within the one-ink/one-paper-per-cell limit. `pattern` is an 8×8 dither tile: a `DITHER` constant (`DITHER.QUARTER` / `DITHER.HALF` / `DITHER.THREE_QUARTERS`, 16/32/48 ink pixels of 64; default `DITHER.HALF`), or **any 8×8 `Uint8Array`** of your own for a different density or texture — you're not boxed into the named three. **Colour-clash-safe by construction:** the whole rect is a single ink + paper, so pick a pair that shares a bright plane (e.g. both bright, or both normal).

```ts
drawShade(ctx, 0, 0, 256, 80, C.BLACK, C.B_BLUE)                 // dim, overcast night sky (default HALF)
drawShade(ctx, x, y, 64, 16, C.BLACK, C.WHITE, DITHER.QUARTER)   // a light hatch
drawShade(ctx, x, y, 64, 16, C.BLACK, C.WHITE, myCustomTile)     // your own 8×8 pattern
```

The `DITHER` tiles are plain 8×8 `Uint8Array`s, so you can also stamp them per-cell with `drawSprite` / `drawBitmap` when you want the dither aligned to the 8×8 grid.

> **Perf:** `drawShade` is per-pixel like the other primitives. For a large **static** backdrop, draw it once or render it onto a cached layer (`cache` module, `createLayerCache`) — don't re-shade a full screen every frame.

### `Bitmap` interface

An arbitrary-size monochrome bitmap. Width must be a positive multiple of 8 so
each row is byte-aligned. `data` is row-major; bit 7 is the leftmost pixel in
each byte.

```ts
interface Bitmap {
  data: Uint8Array
  width: number
  height: number
}
```

Use `Bitmap` for 16x16 enemies, 16x24 heroes, 32x32 bosses, tall objects, and
anything that outgrows the classic 8x8 `drawSprite()` format.

### `createBitmap(data, width, height): Bitmap`

Builds a `Bitmap` from packed bytes and validates the dimensions and byte
count immediately. Throws if width is not byte-aligned, height is invalid, or
the data length does not match `(width / 8) * height`.

```ts
const HERO = createBitmap(new Uint8Array([
  0x03, 0xC0,
  0x07, 0xE0,
  // ...22 more 16px-wide rows
]), 16, 24)
```

### `createBitmapFromRows(rows): Bitmap`

Builds an arbitrary-size `Bitmap` from readable pixel-art rows instead of
hand-packed bytes. This is useful for sprites larger than 8x8 where hex arrays
become hard to review.

- `X` or `#` = solid pixel
- `.` or space = transparent pixel
- every row must have the same width
- width must be a positive multiple of 8

```ts
const TRUCK = createBitmapFromRows([
  '....XXXXXXXX....',
  '..XXXXXXXXXXXX..',
  '.XXXX......XXXX.',
  'XXXXXXXXXXXXXXXX',
  'XX..XXXXXXXX..XX',
  'XX............XX',
  '..XXX......XXX..',
  '................',
])

drawBitmap(ctx, TRUCK, x, y, C.B_WHITE)
```

The returned object is the same `Bitmap` shape produced by `createBitmap()`, so
it works with `drawBitmap`, `drawBitmapAttrs`, `mirrorBitmap`, and collision
helpers such as `bitmapPixelMask`.

### `drawBitmap(ctx, bitmap, x, y, ink, paper?, inkOnly?): void`

Draws an arbitrary-size `Bitmap`. The colour model has three modes, ordered by how much of the background they disturb:

| Call | Paints | Touches the background? |
|------|--------|-------------------------|
| `drawBitmap(ctx, bmp, x, y, ink)` | only the set ink pixels | no — transparent overlay |
| `drawBitmap(ctx, bmp, x, y, ink, paper)` | a full `width×height` paper rectangle, then ink pixels on top | yes — the whole bounding box |
| `drawBitmap(ctx, bmp, x, y, ink, paper, true)` | only the set ink pixels; `paper` is ignored | no |

`inkOnly` (last parameter, default `false`) **suppresses the paper rectangle even when a `paper` colour is supplied.** For `drawBitmap` this is functionally identical to omitting `paper` — its value is ergonomic: keep a sprite's configured `paper` and toggle the opaque box on or off with a boolean, instead of conditionally choosing whether to pass the argument at the call site.

### `mirrorBitmap(src): Bitmap`

Returns a horizontally flipped copy of a `Bitmap`. The original is not
modified. Use it at module load time to derive left-facing sprites from one
right-facing definition.

```ts
const HERO_RIGHT = createBitmapFromRows([...])
const HERO_LEFT = mirrorBitmap(HERO_RIGHT)
```

### `AttrMap` interface

Per-8x8-cell ink and paper colours for a `Bitmap`, mirroring the ZX Spectrum
attribute buffer. `cols` must match `bitmap.width / 8`; `rows` must match
`bitmap.height / 8`.

```ts
interface AttrMap {
  readonly cols: number
  readonly rows: number
  readonly inks: readonly SpectrumColor[]
  readonly papers?: readonly SpectrumColor[]
}
```

Omit `papers` for transparent per-cell ink rendering, or provide papers for
the authentic colour-clash look.

### `createAttrMap(cols, rows, inks, papers?): AttrMap`

Builds an `AttrMap` with validation. `inks` must contain `cols * rows` colours.
`papers` can be omitted, supplied as a matching per-cell array, or supplied as
one colour to fill every cell.

```ts
const HERO_ATTRS = createAttrMap(2, 3, [
  C.B_YELLOW, C.B_YELLOW,
  C.B_RED,    C.B_MAGENTA,
  C.B_CYAN,   C.B_GREEN,
], C.BLACK)
```

### `drawBitmapAttrs(ctx, bitmap, attrs, x, y, inkOnly?): void`

Renders a `Bitmap` with a per-cell `AttrMap` — each 8×8 cell carries its own `(ink, paper)`, the authentic Spectrum attribute model. Here `inkOnly` is **not** redundant: it keeps every per-cell *ink* colour but skips all per-cell *paper* fills. One fully-coloured `AttrMap` (with `papers` for the boxed look on a plain background) then renders two ways — flip `inkOnly` per frame, with no second paper-less map to build and keep in sync. Dimension validation still throws under `inkOnly`: the flag changes what is painted, never the contract.

```ts
// chaosbunny — a blue rabbit with a white belly, hopping through a dark cave:
drawBitmapAttrs(ctx, BUNNY, BUNNY_ATTRS, x, y, true)
//  → per-cell blue/white inks preserved, but no black 8×8 blocks stamped onto
//    the cave behind it. The rabbit reads by its own silhouette.
```

### `mirrorAttrMap(attrs): AttrMap`

Returns a horizontally flipped copy of an `AttrMap`, reversing each attribute
row. Pair it with `mirrorBitmap()` so a mirrored sprite keeps its colours on
the matching 8x8 cells.

```ts
const HERO_LEFT = mirrorBitmap(HERO_RIGHT)
const HERO_LEFT_ATTRS = mirrorAttrMap(HERO_RIGHT_ATTRS)
```

### Why does `inkOnly` exist? (and why is it, honestly, a little bit of debt?)

This is the kind of decision worth writing down, because the "obvious" answer is the wrong one.

**Why was the box there in the first place?** Because that *is* the ZX Spectrum. The real machine had a 256×192 one-bit pixel bitmap and a *separate* 32×24 attribute map: one ink + one paper + bright + flash per 8×8 cell, nothing finer. zx-kit's `drawBitmapAttrs`, and the `paper` argument of `drawBitmap`, model exactly that constraint (added in v0.19.0, *"authentic Spectrum colour clash"*). Fill the cell's paper, draw the ink on top. That's the look, and removing it would make the engine less of a Spectrum, not more.

**So why fight it?** Because the hardware had a *second* technique we had quietly skipped — the **masked sprite.** Cheap games stamped attributes and lived with "colour clash," the famous bleeding of one sprite's colours onto whatever 8×8 cell it touched. The games whose movement looked clean used a *mask*: a second bitmap ANDed into the screen to punch a hole in the exact shape of the sprite, then the sprite ORed in. Only the sprite's own pixels changed — no paper block, no bleed onto the neighbour. `inkOnly` is the modern per-pixel-canvas equivalent of a masked sprite, and on a canvas it comes almost for free: painting only the set pixels already leaves everything else untouched.

**What broke without it?** The same character that broke collision. Picture a Dizzy-style sprite with `paper: C.BLACK` drawn next to a white leaf. The visible pixels never touch the leaf — but the paper rectangle (or the 8×8 paper cell) does, and it paints the leaf's edge black. The bounding box committed the crime; the sprite took the blame. We met this exact bounding-box sin once before, in collision (v0.21.0, *"the Dizzy problem"*): the AABB overlapped a platform the pixels didn't. Same Dizzy, same box, different subsystem — and rendering needed the same answer collision got: *stop trusting the box, trust the pixels.*

**Then why call it debt?** Because the truly faithful fix is bigger than a boolean. A real masking layer would carry an explicit mask bitmap per sprite, or compose against an off-screen attribute buffer the way the hardware did. `inkOnly` is the ~12-line, zero-allocation, fully backwards-compatible shortcut to 90% of that value. For a hobby engine whose stated philosophy is *less is more*, that is the right call — but it is worth being honest that it is a shortcut, not the model. The day a game needs a paper silhouette that hugs the sprite *outline* (paper behind the shape, but not the box) is the day this flag stops being enough and the masking layer earns its place.

### Tested

Both functions are covered by the renderer suite, including the new branch and its edges:

- `inkOnly` suppresses the paper rectangle / per-cell paper blocks (zero fills for an all-zero sprite; ink-only fills for an all-ones sprite);
- per-cell ink colours survive `inkOnly`;
- the default (`false`) still fills paper — a regression guard so the flag can never silently change an existing game;
- `drawBitmap(..., inkOnly)` matches transparent rendering, and `drawBitmapAttrs(..., inkOnly)` matches a paper-less `AttrMap`, pixel-for-pixel;
- **exception path:** `drawBitmapAttrs` still throws on an `AttrMap`/`Bitmap` dimension mismatch with `inkOnly` set.

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

## `cache.ts` — Offscreen Layer Cache

`drawBitmap`, `drawSprite` and `drawTileMapAt` paint **one `fillRect` per lit
pixel** — perfect for a moving sprite, but lethal for a full-screen layer redrawn
every frame (a scrolling tile map can be thousands of `fillRect`s per frame). The
cure is to render that layer **once** to an offscreen canvas, then blit it with a
single `drawImage`.

A `LayerCache` is an offscreen canvas plus a `dirty` flag. `refreshLayer` re-runs
your draw callback **only while the cache is dirty**, then clears the flag; call
`invalidateLayer` whenever the layer's contents change (a tile edited, a level
reset) to force exactly one re-render. Headless-safe: with no `document` the
canvas is `null`, the draw is skipped, and nothing throws.

### `createLayerCache(width, height): LayerCache`

Creates an offscreen cache of the given pixel size, starting `dirty`. Image
smoothing is disabled for crisp ZX output. Create once; reuse across frames.
Throws if `width`/`height` is not a positive number.

### `invalidateLayer(layer): void`

Marks the cache stale so the next `refreshLayer` re-renders it.

### `refreshLayer(layer, render): HTMLCanvasElement | null`

Runs `render(offscreenCtx)` only if the cache is dirty (the context is cleared
first), then clears the flag and returns the offscreen canvas to blit (or `null`
when headless). Blitting is yours: a `drawImage` source window for a scrolling
camera, or `drawImage(canvas, 0, 0)` for a static overlay.

```ts
// Cache a whole tile map; blit a moving camera window each frame.
const world = tileMapWorldSize(map)
const tiles = createLayerCache(world.width, world.height)   // once

// game loop:
refreshLayer(tiles, (lctx) => drawTileMapAt(lctx, map, 0, 0, world.width, world.height))
if (tiles.canvas) ctx.drawImage(tiles.canvas, camX, camY, 256, 192, 0, 0, 256, 192)

// when a tile changes (a platform crumbles, the level resets):
invalidateLayer(tiles)
```

> Pairs naturally with `tilescroll` / `tilemap`: cache the static geometry and
> invalidate only on the rare tile change. The same primitive caches any static
> overlay — e.g. `refreshLayer(overlay, (c) => drawScanlines(c))`.

---

## `attrscreen.ts` — Attribute Clash (opt-in)

The real Spectrum stored the screen as **two planes**: a 1-bit pixel bitmap and a
32×24 grid where each 8×8 cell holds exactly *one* ink + *one* paper. Drawing into a
cell rewrote that single attribute, so the sprite and the background sharing the
cell snapped to the same two colours — the famous **colour clash**.

zx-kit composites in full colour by default (no clash — see *Spectrum-inspired, not
hardware-accurate*). `attrscreen.ts` is the opt-in way to get the authentic bleed,
the same shape as `drawScanlines` / `renderDarkness`: route a frame through an
`AttrScreen`, then `flushAttrScreen` once.

`stampMono` writes a monochrome bitmap's *shape* into the pixel plane and
re-attributes every cell a lit pixel lands in — and it **never clears** other
pixels, so whatever was already in a touched cell renders in the new colour. That
is the clash. The flush resolves both planes into one reused `ImageData` and uploads
it with a single `putImageData` + `drawImage` — never per-pixel `fillRect`.

> Not hardware-exact by choice: ink and paper may be any two of the 15 colours (the
> real machine forced both to share the BRIGHT bit), and FLASH is not modelled (yet).
> Assumes a little-endian platform (every browser). Headless-safe.

### `createAttrScreen(cols = 32, rows = 24): AttrScreen`

Allocates a screen-space attribute plane (default 32×24 cells = 256×192). Create
once; reuse across frames. Throws on a non-positive size.

### `clearAttrScreen(scr, paper, ink?)`

Resets for a new frame: clears all pixels to paper and fills every cell's
attributes (`ink` defaults to `paper`). Call before stamping.

### `stampMono(scr, bitmap, x, y, ink, paper, policy?, glow?)`

Stamps a monochrome `Bitmap` at screen pixel `(x, y)` (rounded; may be sub-cell,
negative, or off-screen — clipped). `policy` controls how touched cells recolour:
`'both'` (default — ink **and** paper, the most authentic bleed), `'ink-only'`
(keep the existing paper), `'paper-only'`. **`glow`** (default `false`) also flags
every touched cell as an emissive GLOW source (`AttrScreen.cellGlow`) for the
`glow.ts` bloom — an opt-in attribute bit, like FLASH. Leaving it off is the old
behaviour exactly.

### `flushAttrScreen(ctx, scr)`

Resolves the two planes into RGBA and uploads with one `putImageData` + `drawImage`
at `(0, 0)` under the current transform (so `setupCanvas`'s `×scale` fills the
canvas). Headless: fills `scr.rgba` and skips the blit.

```ts
const scr = createAttrScreen()                              // once
// each frame, in screen space:
clearAttrScreen(scr, C.BLACK)
stampMono(scr, caveBitmap,   0,  0, C.B_BLUE,  C.BLACK)     // background
stampMono(scr, rabbitBitmap, rx, ry, C.B_WHITE, C.BLACK)    // sprite → its cells clash to white
flushAttrScreen(ctx, scr)
```

> A cell clashes only when a lit pixel lands in it (silhouette clash), so a sprite
> recolours exactly the cells it visibly occupies.

### `drawAttrGlowSources(scr, g)`

Draws every `glow`-flagged cell as a solid 8×8 block in its ink colour into the
emissive context `g` — the bridge from an attribute screen to `glow.ts`. Use it as
the `renderGlow` callback so clash-mode games (chaosBunny) get bloom straight from
the attribute bit; cell-level, like FLASH. Draws nothing when no cell is flagged.

```ts
// stamp a torch cell with glow on, then bloom it:
stampMono(scr, torchBitmap, tx, ty, C.B_YELLOW, C.BLACK, 'both', true)
flushAttrScreen(ctx, scr)                                   // the crisp clash frame
renderGlow(glowLayer, ctx, (g) => drawAttrGlowSources(scr, g))  // + the additive halo
```

---

## `monoscreen.ts` — Monochrome Playfield

The surest cure for attribute clash is to not have it: render the action area in a
**single ink + paper** and keep the colour in a separate HUD/border. Light Force,
Bobby Bearing, Highway Encounter and Head Over Heels all did exactly this.

A `MonoScreen` is a **1-bit foreground mask of its own size** (smaller than the
canvas) plus two colours. Everything drawn into it collapses to ink (lit pixels)
or paper — a white sprite, a green tile and a cyan hero all become the same ink, so
they can never clash. Draw the colourful HUD normally *outside* the region;
`flushMonoScreen` blits the playfield at an offset.

Versus `attrscreen` (authentic *per-cell* clash): mono is one ink/paper for the
**whole** region — simpler, cheaper, and the right tool for a clean retro look
rather than the colour-bleed artefact. Flush is one `putImageData` + `drawImage`.
Little-endian; headless-safe.

### `createMonoScreen(width, height, ink, paper): MonoScreen`

Creates a playfield of its own pixel size (not the canvas). `ink`/`paper` are
mutable — recolour the whole playfield any time (e.g. per biome). Throws on a
non-positive size.

### `clearMonoScreen(scr)`

Resets the mask to all-paper. Call at the start of each frame.

### `drawMonoBitmap(scr, bitmap, x, y)`

Draws a monochrome `Bitmap`'s lit pixels as foreground (clipped). Clear pixels are
left untouched, so paper and earlier draws show through.

### `fillMono(scr, x, y, w, h)`

Sets a filled foreground rectangle (clipped) — a 1px-wide rect is a thread, rail or
laser; a block is a platform.

### `flushMonoScreen(ctx, scr, dx?, dy?)`

Resolves the mask (ink where lit, paper elsewhere) and blits the region at canvas
offset `(dx, dy)` under the current transform. Headless: fills `scr.rgba`, skips
the blit.

```ts
const play = createMonoScreen(256, 160, C.BLACK, C.B_CYAN)   // playfield, once
// each frame, in playfield space:
clearMonoScreen(play)
drawMonoBitmap(play, tileBmp, tx, ty)
drawMonoBitmap(play, heroBmp, hx, hy)
fillMono(play, threadX, threadY, 1, len)
flushMonoScreen(ctx, play, 0, 16)            // playfield below a 16px colour HUD
```

> Tip: it carries its own `ink`/`paper`, so a one-line swap reskins the whole
> playfield — a cheap "biome" tint or a damage flash.

---

## `tilescroll.ts` — Pixel-Smooth Scrolling

[`tilemap.ts`](api.md#tilemapts--tile-map-engine)'s `render(viewport)` takes a viewport in **whole tiles**, so a camera can only move in 8-pixel steps. That is perfect for grid games, but visibly steppy in a platformer where the player moves sub-pixel-smooth while jumping. `tilescroll.ts` renders the map at an **arbitrary pixel camera position** by drawing one overscan row/column and offsetting every tile by the camera remainder.

Pair it with [`camera.ts`](api.md#camerats--scrolling-camera): use `tileMapWorldSize` for the camera's `worldW` / `worldH`, then feed `cam.x` / `cam.y` straight into `drawTileMapAt`.

### `tileMapWorldSize(map): { width, height }`

Returns the map's full size in pixels (`cols × CELL`, `rows × CELL`) — handy for the camera's world bounds.

```ts
import { createCamera } from 'zx-kit'
const cam = createCamera({ viewW: 256, viewH: 192, ...tileMapWorldSize(map) })
```

### `drawTileMapAt(ctx, map, camX, camY, viewW?, viewH?): void`

Renders `map` with the viewport's top-left at world pixel `(camX, camY)`. The camera position is rounded to whole pixels for crisp output; off-screen and empty cells are skipped. `viewW` (default `256`) and `viewH` (default `192`) must be positive — throws otherwise. The leading/trailing partial tiles are drawn and naturally clipped by the canvas bounds, so keep the play area at the canvas origin (or render the map first) to avoid spilling under a status bar.

```ts
// game loop
setCameraTarget(cam, player.x, player.y)
tickCamera(cam, dt)
drawTileMapAt(ctx, map, cam.x, cam.y)          // smooth background
renderSprite(ctx, /* player drawn at (x - cam.x, y - cam.y) */)
```

---

## `lighting.ts` — Dithered Cave Darkness

The ZX way to fake light: hard 8×8 light pools with an ordered (Bayer) **dither** edge — no alpha gradients. The look of *Knight Lore* / *Head over Heels*, not modern soft shadows.

Done the naive way (recompute a full-screen `ImageData` and `putImageData` it every frame) this is a real CPU/upload hog — it measured ~27% of a frame in an actual game. This module instead **pre-renders the dither for each darkness level to a tiny tile, darkens the view cell-by-cell into a persistent buffer (repainting only cells whose level changed), and blits the buffer with one `drawImage`** — no per-frame `putImageData`.

You own the *policy* (where it's dark) via a per-cell callback; the module owns the fast *rendering*.

### `Light` interface

```ts
interface Light { x: number; y: number; radius: number; intensity: number } // intensity 0..1
```

### `brightnessAt(px, py, lights): number`

Brightest attenuated light at a point — `max((1 - dist/radius) * intensity)` over all lights, clamped to `0..1`. Turn it into darkness with `1 - brightnessAt(...)`. Pure.

### `ditherBlack(px, py, amount): boolean`

The ordered-dither rule used to bake the tiles: is pixel `(px, py)` black at darkness `amount` (0..1)? Pure and deterministic — handy for tests or custom effects.

### `createDarknessLayer(width, height, levels?): DarknessLayer`

Builds a view-sized overlay: pre-bakes `levels` dither tiles (default **8** — more = smoother), a persistent buffer, and a per-cell level cache. Call **once**; reuse across frames. Throws if `levels < 2`.

### `renderDarkness(layer, ctx, darknessAt): void`

Darkens `ctx` for this frame. `darknessAt(col, row)` returns the darkness of each 8×8 cell — **0 = lit, 1 = pitch black** (clamped, then quantised to the layer's levels). Only cells whose level changed since the last call are repainted; then the buffer is blitted once.

```ts
import { createDarknessLayer, renderDarkness, brightnessAt, CELL } from 'zx-kit'

const dark = createDarknessLayer(256, 192)           // once

// each frame, after drawing the scene, before the HUD:
const lights = [{ x: playerX, y: playerY, radius: 72, intensity: 1 }]
renderDarkness(dark, ctx, (col, row) => {
  const b = brightnessAt(col * CELL + 4, row * CELL + 4, lights)
  return 1 - b                                        // 0 = lit … 1 = dark
})
```

The `darknessAt` callback is where you add **depth gradients** (darker the deeper you are), fog, flashing — anything; the renderer stays fast because it only repaints cells whose quantised level actually changed.

> Lights are in **screen** pixels (apply the camera yourself). Rendering needs a real canvas; in a headless test environment the layer degrades to a no-op blit while the level math still runs.

---

## `glow.ts` — Additive Phosphor Bloom (opt-in)

The **additive** twin of `lighting`: where `renderDarkness` *subtracts* light, `renderGlow` *adds* it. You mark your **light sources** — a torch, the moon, a sonar/radar blip — and their colour bleeds softly into the neighbours, so overlapping haloes sum into *perceived* extra colours **on the glass**, while the crisp pixel-art framebuffer keeps its flat palette. **Opt-in and purely additive:** a game that never calls it renders exactly as before (it tree-shakes away).

Cheap, no WebGL: the emissive layer is **downscaled** to a small buffer and **upscaled** back with bilinear smoothing — that scaling *is* the blur, for free — then blitted with `globalCompositeOperation = 'lighter'`.

### `createGlowLayer(width, height, opts?): GlowLayer`

Allocates a view-sized glow layer once; reuse across frames. `opts` (`GlowOptions`) tune the bloom: `downscale` (blur strength, default 4), `passes` (additive blits for a brighter halo, default 1), `alpha` (bloom strength 0..1, default 0.5). Headless (no `document`): both canvases are `null` and `renderGlow` is a no-op.

### `drawGlowSource(g, source): void`

Convenience for the `renderGlow` callback: draws one `GlowSource` — a soft radial blob in the source's **own colour**, scaled by `intensity` (0..1) — into the emissive context `g`. `{ x, y, radius, color, intensity? }`.

### `renderGlow(layer, ctx, drawSources): void`

Call each frame **after** the scene (and before scanlines / `curveDisplay`). `drawSources(g)` receives the emissive canvas context — draw your sources into it. Their colour is blurred and blitted onto `ctx` additively, then `ctx`'s composite/alpha/smoothing are restored.

```ts
import { createGlowLayer, drawGlowSource, C } from 'zx-kit'

const glow = createGlowLayer(256, 192)               // once

// each frame, after the scene, before scanlines:
renderGlow(glow, ctx, (g) => {
  drawGlowSource(g, { x: torchX, y: torchY, radius: 24, color: C.B_YELLOW, intensity: 0.9 })
  drawGlowSource(g, { x: moonX,  y: moonY,  radius: 40, color: C.B_WHITE,  intensity: 0.5 })
  // …or draw sprites/pixels straight into `g` for pixel-exact glow
})
```

> Sources are in **screen** pixels. Only *light sources* glow (path B — an emissive marker, never a lighter flat colour), so the palette is never diluted. Rendering needs a real canvas; headless it is a no-op while the pure helpers (`glowBufferSize`) still run. Pair with `lighting` for the full "dark cave, glowing torch" look: darkness first, glow second.

---
