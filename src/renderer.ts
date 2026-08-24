import { C, CELL, type SpectrumColor } from './palette.js'
import { getCharRow } from './font.js'

function _draw8x8Bits(
  ctx: CanvasRenderingContext2D,
  getByte: (row: number) => number,
  x: number,
  y: number,
): void {
  for (let row = 0; row < 8; row++) {
    const byte = getByte(row)
    for (let bit = 0; bit < 8; bit++) {
      if (byte & (0x80 >> bit)) ctx.fillRect(x + bit, y + row, 1, 1)
    }
  }
}

/**
 * Initialises a canvas element for pixel-perfect scaled rendering.
 * Sets canvas dimensions, applies CSS size, disables image smoothing, applies `ctx.scale()`,
 * and returns the 2D context. All subsequent draw calls use game-pixel coordinates.
 * Call once at game startup.
 *
 * @param canvas  - The `<canvas>` element to configure
 * @param scale   - CSS pixels per game pixel (e.g. `4` for standard ZX Spectrum display)
 * @param width   - Canvas width in game pixels (default `256`)
 * @param height  - Canvas height in game pixels (default `192`)
 * @returns The configured `CanvasRenderingContext2D` (already scaled — draw in game pixels)
 *
 * @example
 * const canvas = document.getElementById('game') as HTMLCanvasElement
 * const ctx = setupCanvas(canvas, 4)          // 256×192 game px → 1024×768 CSS px
 * const ctx = setupCanvas(canvas, 4, 256, 208) // taller canvas for status rows
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  scale: number,
  width = 256,
  height = 192,
): CanvasRenderingContext2D {
  canvas.width = width * scale
  canvas.height = height * scale
  canvas.style.width = `${width * scale}px`
  canvas.style.height = `${height * scale}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error(
      'setupCanvas: failed to obtain a 2D context — the canvas may already have ' +
      'a different context type (e.g. WebGL) bound, or 2D rendering is unsupported.',
    )
  }
  ctx.imageSmoothingEnabled = false
  ctx.scale(scale, scale)
  return ctx
}

/**
 * Applies a CRT monitor curvature effect to the canvas element via CSS.
 *
 * Current implementation: rounded corners (`border-radius`) and an inset edge shadow
 * to simulate the dark vignette of a CRT bezel. This is a deliberate abstraction —
 * the CSS internals may be replaced by WebGL barrel distortion in a future version
 * without changing this API signature.
 *
 * Call once after `setupCanvas`. Call again with `intensity = 0` to remove.
 *
 * @param canvas    - The `<canvas>` element to apply the effect to
 * @param intensity - Strength 0–1 (default `1`; `0` removes all effect)
 *
 * @example
 * const ctx = setupCanvas(canvas, 4)
 * curveDisplay(canvas)        // default full intensity
 * curveDisplay(canvas, 0.5)   // subtle effect
 * curveDisplay(canvas, 0)     // remove effect
 */
export function curveDisplay(canvas: HTMLCanvasElement, intensity = 1): void {
  const i = Math.max(0, Math.min(1, intensity))
  if (i === 0) {
    canvas.style.borderRadius = ''
    canvas.style.boxShadow = ''
    return
  }
  canvas.style.borderRadius = `${Math.round(18 * i)}px`
  canvas.style.boxShadow = `inset 0 0 ${Math.round(60 * i)}px rgba(0,0,0,${(0.45 * i).toFixed(2)})`
}

/**
 * Flips an 8×8 sprite horizontally. Returns a new `Uint8Array`.
 * Use to derive left-facing sprites from right-facing definitions at module load time.
 *
 * @example
 * export const PLAYER_RIGHT = new Uint8Array([0x18, 0x3C, ...])
 * export const PLAYER_LEFT  = mirrorSprite(PLAYER_RIGHT)
 */
export function mirrorSprite(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(8)
  for (let r = 0; r < 8; r++) {
    let b = src[r], m = 0
    for (let i = 0; i < 8; i++) {
      if (b & (1 << i)) m |= (1 << (7 - i))
    }
    out[r] = m
  }
  return out
}

/**
 * Draws an 8×8 sprite at game coordinates `(x, y)`.
 * Always fills the full `CELL×CELL` area with `paper` first, then renders `ink` pixels.
 *
 * @param ctx    - Target canvas context
 * @param sprite - 8-byte sprite bitmap (one byte per row, bit 7 = leftmost pixel)
 * @param x      - Left edge in game pixels
 * @param y      - Top edge in game pixels
 * @param ink    - Foreground color (`C.*` palette value)
 * @param paper  - Background color (`C.*` palette value)
 *
 * @example
 * drawSprite(ctx, MINE_SPRITE, col * CELL, row * CELL, C.B_RED, C.BLACK)
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Uint8Array,
  x: number, y: number,
  ink: SpectrumColor, paper: SpectrumColor,
): void {
  ctx.fillStyle = paper
  ctx.fillRect(x, y, CELL, CELL)
  ctx.fillStyle = ink
  _draw8x8Bits(ctx, row => sprite[row], x, y)
}

/**
 * Draws a single ASCII character at game coordinates using the ROM font.
 * If `paper` is omitted the background is not cleared (transparent).
 *
 * @param ctx   - Target canvas context
 * @param code  - ASCII character code (32–127); 127 = solid block █
 * @param x     - Left edge in game pixels
 * @param y     - Top edge in game pixels
 * @param ink   - Foreground color
 * @param paper - Optional background color; omit for transparent background
 *
 * @example
 * drawChar(ctx, 127, x, y, C.B_GREEN, C.BLACK)           // solid block █
 * drawChar(ctx, 'A'.charCodeAt(0), x, y, C.B_WHITE)      // transparent bg
 */
export function drawChar(
  ctx: CanvasRenderingContext2D,
  code: number,
  x: number, y: number,
  ink: SpectrumColor, paper?: SpectrumColor,
): void {
  if (paper !== undefined) {
    ctx.fillStyle = paper
    ctx.fillRect(x, y, CELL, CELL)
  }
  ctx.fillStyle = ink
  _draw8x8Bits(ctx, row => getCharRow(code, row), x, y)
}

/**
 * Draws a string left-to-right starting at game coordinates `(x, y)`.
 * Each character occupies one `CELL`-wide slot.
 *
 * @param ctx   - Target canvas context
 * @param text  - ASCII string to render
 * @param x     - Left edge in game pixels
 * @param y     - Top edge in game pixels
 * @param ink   - Foreground color
 * @param paper - Optional background color
 *
 * @example
 * drawText(ctx, 'SCORE:00000', 0, statusY, C.B_WHITE, C.BLACK)
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  ink: SpectrumColor, paper?: SpectrumColor,
): void {
  for (let i = 0; i < text.length; i++) {
    drawChar(ctx, text.charCodeAt(i), x + i * CELL, y, ink, paper)
  }
}

/**
 * Draws a string centered horizontally within a canvas of `cols` character columns.
 *
 * @param ctx   - Target canvas context
 * @param text  - ASCII string to render
 * @param y     - Top edge in game pixels
 * @param cols  - Total character columns (canvas width ÷ `CELL`, e.g. 32 for standard Spectrum)
 * @param ink   - Foreground color
 * @param paper - Optional background color
 *
 * @example
 * // Bind cols once to avoid passing it every time:
 * const centered = (ctx: CanvasRenderingContext2D, text: string, y: number, ink: SpectrumColor) =>
 *   drawTextCentered(ctx, text, y, COLS, ink)
 * centered(ctx, 'GAME  OVER', y, C.B_RED)
 */
export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  cols: number,
  ink: SpectrumColor, paper?: SpectrumColor,
): void {
  const x = Math.floor((cols - text.length) / 2) * CELL
  drawText(ctx, text, x, y, ink, paper)
}

/**
 * Draws a CRT scanline overlay over the entire canvas.
 * Darkens every other physical pixel row with a semi-transparent black rectangle,
 * simulating the gap between phosphor lines on a CRT monitor.
 *
 * Must be called **after** the frame is fully rendered (last draw call each tick).
 * Temporarily resets the canvas transform so lines are drawn in physical pixels,
 * independent of the game-pixel scale set by `setupCanvas`.
 *
 * @param ctx   - Target canvas context (same one used for game rendering)
 * @param alpha - Opacity of each scanline stripe (default `0.25`; range 0–1)
 *
 * @example
 * // At the end of your render function:
 * drawScanlines(ctx)          // default 25% opacity
 * drawScanlines(ctx, 0.35)    // stronger effect
 */
export function drawScanlines(
  ctx: CanvasRenderingContext2D,
  alpha = 0.25,
): void {
  const { width, height } = ctx.canvas
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  for (let y = 1; y < height; y += 2) {
    ctx.fillRect(0, y, width, 1)
  }
  ctx.restore()
}

// ─── Dither / shade ──────────────────────────────────────────────────────────

/**
 * Named 8×8 ordered-dither patterns (one byte per row, bit 7 = leftmost pixel) for
 * faking an intermediate shade within the ZX one-ink/one-paper-per-cell limit —
 * the classic way to get "halftones" out of two colours. These are the three
 * common densities; pass any other 8×8 `Uint8Array` to {@link drawShade} for a
 * different density or texture. Usable directly with {@link drawSprite} /
 * {@link drawBitmap} too, when you want the pattern aligned to the 8×8 grid.
 */
export const DITHER = {
  /** 16/64 ink pixels — a light hatch. */
  QUARTER:        new Uint8Array([0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22]),
  /** 32/64 ink pixels — a 50% checkerboard. */
  HALF:           new Uint8Array([0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55]),
  /** 48/64 ink pixels — a dense hatch. */
  THREE_QUARTERS: new Uint8Array([0x77, 0xDD, 0x77, 0xDD, 0x77, 0xDD, 0x77, 0xDD]),
} as const

/**
 * Fills a `w×h` rectangle (game pixels) with an ordered-dither **shade** of `ink`
 * over `paper` — a tone between the two solid colours, within the one-ink/one-paper
 * limit. `pattern` is an 8×8 dither tile: a {@link DITHER} constant
 * (`DITHER.QUARTER` / `HALF` / `THREE_QUARTERS`), or **any 8×8 `Uint8Array`** of your
 * own for a different density/texture. Colour-clash-safe by construction: the
 * caller picks an `ink`/`paper` pair sharing a bright plane (the whole rect is one
 * ink + one paper).
 *
 * Per-pixel like the kit's other primitives, so for a large **static** backdrop
 * draw it once, or cache it on a {@link createLayerCache} layer — don't re-shade
 * a full screen every frame.
 *
 * @example
 * drawShade(ctx, 0, 0, 256, 80, C.BLACK, C.B_BLUE)                 // a dim, overcast night sky (default HALF)
 * drawShade(ctx, x, y, 64, 16, C.BLACK, C.WHITE, DITHER.QUARTER)   // a light hatch
 * drawShade(ctx, x, y, 64, 16, C.BLACK, C.WHITE, myCustomTile)     // your own 8×8 pattern
 */
export function drawShade(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ink: SpectrumColor, paper: SpectrumColor,
  pattern: Uint8Array = DITHER.HALF,
): void {
  ctx.fillStyle = paper
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = ink
  for (let py = 0; py < h; py++) {
    const bits = pattern[py & 7]!
    for (let px = 0; px < w; px++) {
      if (bits & (0x80 >> (px & 7))) ctx.fillRect(x + px, y + py, 1, 1)
    }
  }
}

// ─── Bitmap API — arbitrary-size sprites ─────────────────────────────────────

/**
 * An arbitrary-size monochrome bitmap. Width must be a multiple of 8 (byte-aligned).
 * `data` is row-major: `(width/8) * height` bytes, with bit 7 = leftmost pixel of each byte.
 *
 * Common sizes:
 * - 16×16 → 32 bytes (small character, Manic Miner style)
 * - 16×24 → 48 bytes (taller character, Jetman style)
 * - 24×24 → 72 bytes (large enemy)
 * - 32×32 → 128 bytes (boss / vehicle)
 *
 * Use {@link createBitmap} for safe construction, {@link drawBitmap} to render,
 * {@link mirrorBitmap} to derive a horizontally-flipped variant.
 */
export interface Bitmap {
  /** Row-major pixel data: bytes = (width/8) * height. Bit 7 of each byte is the leftmost pixel. */
  data: Uint8Array
  /** Width in pixels. Must be a positive multiple of 8. */
  width: number
  /** Height in pixels. Must be positive. */
  height: number
}

/**
 * Constructs a {@link Bitmap} with validation. Throws on invalid dimensions
 * or wrong byte count so the error surfaces at definition time, not render time.
 *
 * @example
 * const JETMAN_STAND = createBitmap(new Uint8Array([
 *   0x03, 0xC0,  // row 0  (16 px wide → 2 bytes per row)
 *   0x07, 0xE0,  // row 1
 *   // … 22 more rows
 * ]), 16, 24)
 */
export function createBitmap(data: Uint8Array, width: number, height: number): Bitmap {
  if (!Number.isInteger(width) || width <= 0 || width % 8 !== 0) {
    throw new Error(`createBitmap: width must be a positive multiple of 8, got ${width}`)
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`createBitmap: height must be a positive integer, got ${height}`)
  }
  const expected = (width / 8) * height
  if (data.length !== expected) {
    throw new Error(
      `createBitmap: data length mismatch — expected ${expected} bytes for ${width}×${height}, got ${data.length}`,
    )
  }
  return { data, width, height }
}

/**
 * Constructs a {@link Bitmap} from readable pixel rows.
 *
 * Each string represents one bitmap row. `#` and `X` are treated as solid pixels;
 * `.` and space are treated as transparent pixels. All rows must have identical
 * width, and that width must be a positive multiple of 8 so the result is byte-aligned
 * for the normal {@link createBitmap} / {@link drawBitmap} pipeline.
 *
 * @example
 * const PLAYER = createBitmapFromRows([
 *   '...XX...',
 *   '..XXXX..',
 *   '.XXXXXX.',
 *   'XXXXXXXX',
 *   'XXXXXXXX',
 *   '.XXXXXX.',
 *   '..X..X..',
 *   '.XX..XX.',
 * ])
 */
export function createBitmapFromRows(rows: readonly string[]): Bitmap {
  if (rows.length === 0) {
    throw new Error('createBitmapFromRows: rows must not be empty')
  }

  const height = rows.length
  const width = rows[0]!.length
  if (width === 0) {
    throw new Error('createBitmapFromRows: row width must be positive')
  }
  if (width % 8 !== 0) {
    throw new Error(`createBitmapFromRows: row width must be a positive multiple of 8, got ${width}`)
  }

  const bytesPerRow = width / 8
  const data = new Uint8Array(bytesPerRow * height)
  for (let row = 0; row < height; row++) {
    const line = rows[row]!
    if (line.length !== width) {
      throw new Error(
        `createBitmapFromRows: row ${row} length mismatch — expected ${width}, got ${line.length}`,
      )
    }

    for (let col = 0; col < width; col++) {
      const ch = line[col]
      if (ch === '.' || ch === ' ') continue
      if (ch !== '#' && ch !== 'X') {
        throw new Error(
          `createBitmapFromRows: invalid pixel '${ch}' at row ${row}, col ${col}; ` +
          'use #/X for solid and ./space for transparent',
        )
      }

      const byteIdx = row * bytesPerRow + Math.floor(col / 8)
      data[byteIdx]! |= 0x80 >> (col % 8)
    }
  }

  return createBitmap(data, width, height)
}

/**
 * Draws a {@link Bitmap} of arbitrary width and height at game coordinates `(x, y)`.
 * If `paper` is provided, fills the full bounding rectangle first; otherwise leaves the
 * background untouched (transparent).
 *
 * Same ink/paper applies to the whole sprite — there is no per-cell colour attribute.
 * For multi-colour effects, overlay several bitmaps at the same position.
 *
 * **`inkOnly`** suppresses the `paper` fill even when a `paper` colour is supplied:
 * only the set ink pixels are painted, so the sprite never modifies a single pixel
 * outside its own shape. This kills the "black box bleed" — e.g. a Dizzy sprite with
 * `paper: C.BLACK` sliding next to a white leaf no longer paints the leaf's edge
 * black where its bounding rectangle merely *touches* the leaf's cell. For
 * `drawBitmap` this equals omitting `paper`; the flag lets you keep a configured
 * `paper` and toggle the opaque box on/off without rewriting the call.
 *
 * @example
 * drawBitmap(ctx, JETMAN_STAND, x, y, C.B_WHITE, C.BLACK)
 * drawBitmap(ctx, ROCKET_BASE,  x, y, C.B_YELLOW)              // transparent background
 * drawBitmap(ctx, DIZZY, x, y, C.B_WHITE, C.BLACK, true)       // keep paper config, draw ink only
 */
export function drawBitmap(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  x: number, y: number,
  ink: SpectrumColor,
  paper?: SpectrumColor,
  inkOnly = false,
): void {
  const { data, width, height } = bitmap
  const bytesPerRow = width / 8

  if (paper !== undefined && !inkOnly) {
    ctx.fillStyle = paper
    ctx.fillRect(x, y, width, height)
  }
  ctx.fillStyle = ink
  for (let row = 0; row < height; row++) {
    const rowOffset = row * bytesPerRow
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      const byte = data[rowOffset + byteIdx]
      if (!byte) continue
      const colBase = byteIdx * 8
      for (let bit = 0; bit < 8; bit++) {
        if (byte & (0x80 >> bit)) ctx.fillRect(x + colBase + bit, y + row, 1, 1)
      }
    }
  }
}

/**
 * Returns a horizontally-flipped copy of `src`. The original is not modified.
 * Use at module load time to derive left-facing sprites from right-facing definitions.
 *
 * @example
 * export const HERO_RIGHT = createBitmap(HERO_RIGHT_BYTES, 16, 24)
 * export const HERO_LEFT  = mirrorBitmap(HERO_RIGHT)
 */
export function mirrorBitmap(src: Bitmap): Bitmap {
  const { data, width, height } = src
  const bytesPerRow = width / 8
  const out = new Uint8Array(data.length)

  for (let row = 0; row < height; row++) {
    const rowOffset = row * bytesPerRow
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      const srcByte = data[rowOffset + byteIdx]
      let m = 0
      for (let bit = 0; bit < 8; bit++) {
        if (srcByte & (1 << bit)) m |= (1 << (7 - bit))
      }
      out[rowOffset + (bytesPerRow - 1 - byteIdx)] = m
    }
  }

  return { data: out, width, height }
}

// ─── AttrMap — per-cell ink/paper (authentic ZX colour-clash) ────────────────

/**
 * Per-8×8-cell ink and paper colours for a {@link Bitmap}, mirroring the real
 * ZX Spectrum attribute buffer. Each 8×8 cell carries its own `(ink, paper)`
 * pair — exactly the constraint that produced the famous "colour clash" look
 * of games like Manic Miner, Jet-Pac and Knight Lore.
 *
 * `inks` and `papers` are flat row-major arrays of length `cols * rows`.
 * `papers` is optional: when omitted, the background is left untouched
 * (transparent rendering for overlays). For authentic Spectrum visuals,
 * supply `papers` — every attribute cell on a real Spectrum always had one.
 *
 * Use {@link createAttrMap} to build, {@link drawBitmapAttrs} to render with
 * the bitmap, {@link mirrorAttrMap} to derive the left-facing colour layout.
 */
export interface AttrMap {
  /** Attribute columns. Must equal `bitmap.width / 8`. */
  readonly cols: number
  /** Attribute rows. Must equal `bitmap.height / 8`. */
  readonly rows: number
  /** Per-cell ink colours, row-major, length `cols * rows`. */
  readonly inks: readonly SpectrumColor[]
  /** Per-cell paper colours, row-major. `undefined` → all cells transparent. */
  readonly papers?: readonly SpectrumColor[]
}

/**
 * Constructs an {@link AttrMap} with validation. Throws on length mismatch.
 *
 * Accepts `papers` as either a per-cell array OR a single colour (shorthand
 * for "every cell uses this paper"). Omit `papers` entirely for a transparent
 * sprite — useful for overlays on top of an already-painted background.
 *
 * @example
 * // 16×24 hero with three coloured horizontal stripes on black paper
 * const HERO_ATTRS = createAttrMap(2, 3, [
 *   C.B_YELLOW, C.B_YELLOW,   // head row
 *   C.B_RED,    C.B_RED,      // body row
 *   C.B_BLUE,   C.B_BLUE,     // legs row
 * ], C.BLACK)
 *
 * // 16×16 enemy with mixed inks AND mixed papers
 * const ENEMY_ATTRS = createAttrMap(2, 2, [
 *   C.B_WHITE,  C.B_CYAN,
 *   C.B_GREEN,  C.B_MAGENTA,
 * ], [
 *   C.BLACK, C.BLACK,
 *   C.RED,   C.RED,
 * ])
 */
export function createAttrMap(
  cols: number,
  rows: number,
  inks: SpectrumColor[],
  papers?: SpectrumColor[] | SpectrumColor,
): AttrMap {
  if (!Number.isInteger(cols) || cols <= 0) {
    throw new Error(`createAttrMap: cols must be a positive integer, got ${cols}`)
  }
  if (!Number.isInteger(rows) || rows <= 0) {
    throw new Error(`createAttrMap: rows must be a positive integer, got ${rows}`)
  }
  const expected = cols * rows
  if (inks.length !== expected) {
    throw new Error(
      `createAttrMap: inks length mismatch — expected ${expected} for ${cols}×${rows}, got ${inks.length}`,
    )
  }

  let papersArr: SpectrumColor[] | undefined
  if (papers === undefined) {
    papersArr = undefined
  } else if (typeof papers === 'string') {
    papersArr = new Array(expected).fill(papers)
  } else {
    if (papers.length !== expected) {
      throw new Error(
        `createAttrMap: papers length mismatch — expected ${expected} for ${cols}×${rows}, got ${papers.length}`,
      )
    }
    papersArr = papers
  }

  return { cols, rows, inks, papers: papersArr }
}

// ─── SCR — the native ZX Spectrum screen file ──────────────────────────────────

/** 6144 bytes of bitmap followed by 768 attribute bytes — a whole 256×192 screen. */
const SCR_BYTES = 6912

// Hardware colour order: the 3-bit INK/PAPER fields index straight into these.
const SCR_NORMAL: readonly SpectrumColor[] = [
  C.BLACK, C.BLUE, C.RED, C.MAGENTA, C.GREEN, C.CYAN, C.YELLOW, C.WHITE,
]
const SCR_BRIGHT: readonly SpectrumColor[] = [
  C.B_BLACK, C.B_BLUE, C.B_RED, C.B_MAGENTA, C.B_GREEN, C.B_CYAN, C.B_YELLOW, C.B_WHITE,
]

/** A decoded `.scr` screen: pixels, per-cell colours, and the FLASH plane. */
export interface SpectrumScreen {
  /** 256×192, already de-interleaved into zx-kit's linear row order. */
  bitmap: Bitmap
  /** 32×24 per-cell ink and paper. */
  attrs: AttrMap
  /** Per-cell FLASH bit, row-major, length 768. {@link AttrMap} has no FLASH field. */
  flash: readonly boolean[]
}

/**
 * Parses a **`.scr` file** — the raw ZX Spectrum screen memory dump, and the format
 * every Spectrum paint tool and screen converter emits. It is the graphics twin of
 * `parsePSG` in `aydump.ts`: where that replays a register dump into the AY chip,
 * this replays a memory dump onto the canvas.
 *
 * **Palette validity is structural, not checked.** An attribute byte spends 3 bits on
 * INK and 3 on PAPER, so there is no bit pattern that can name a colour outside the
 * 16 — nor more than one ink and one paper per cell, nor two BRIGHT banks in one cell.
 * A `.scr` therefore *cannot* smuggle in a 32-colour image the way a PNG can. The
 * guarantee covers the asset, not the canvas: nothing stops a game painting an
 * off-palette `fillStyle` afterwards.
 *
 * Screen memory is not stored in reading order — the Y coordinate is interleaved
 * across three 64-line thirds, which is why a half-loaded Spectrum screen filled in
 * those characteristic bands. This function undoes that, so the returned
 * {@link Bitmap} is ordinary top-to-bottom rows.
 *
 * @param bytes - Exactly 6912 bytes. `.scr` has no header or magic number, so the
 *   length is the only thing that can be verified.
 * @throws If `bytes.length` is not 6912.
 *
 * @example
 * const screen = parseSCR(LOADING_SCREEN_BYTES)
 * drawBitmapAttrs(ctx, screen.bitmap, screen.attrs, 0, 0)
 */
export function parseSCR(bytes: Uint8Array): SpectrumScreen {
  if (bytes.length !== SCR_BYTES) {
    throw new Error(
      `parseSCR: expected ${SCR_BYTES} bytes (6144 bitmap + 768 attributes), got ${bytes.length}`,
    )
  }

  // De-interleave: third = y bits 6-7, char row = y bits 3-5, pixel line = y bits 0-2.
  const data = new Uint8Array(32 * 192)
  for (let y = 0; y < 192; y++) {
    const src = ((y & 0xC0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2)
    const dst = y * 32
    for (let cx = 0; cx < 32; cx++) data[dst + cx] = bytes[src + cx]!
  }

  const inks: SpectrumColor[] = new Array(768)
  const papers: SpectrumColor[] = new Array(768)
  const flash: boolean[] = new Array(768)
  for (let i = 0; i < 768; i++) {
    const attr = bytes[6144 + i]!
    // BRIGHT is one bit for the whole cell, so ink and paper always share a bank.
    const bank = (attr & 0x40) ? SCR_BRIGHT : SCR_NORMAL
    inks[i] = bank[attr & 0x07]!
    papers[i] = bank[(attr >> 3) & 0x07]!
    flash[i] = (attr & 0x80) !== 0
  }

  return {
    bitmap: createBitmap(data, 256, 192),
    attrs: createAttrMap(32, 24, inks, papers),
    flash,
  }
}

/**
 * Renders a {@link Bitmap} with per-cell {@link AttrMap} colours — authentic
 * ZX Spectrum attribute rendering. Each 8×8 cell of the bitmap is painted
 * with the ink/paper pair from the matching cell of `attrs`.
 *
 * The attribute dimensions must match the bitmap exactly:
 * `attrs.cols * 8 === bitmap.width`, `attrs.rows * 8 === bitmap.height`.
 *
 * **`inkOnly`** keeps every per-cell *ink* colour but skips all per-cell *paper*
 * fills, so the sprite composites over a busy background by its own silhouette
 * instead of stamping opaque 8×8 paper blocks onto neighbouring tiles. Use one
 * fully-coloured {@link AttrMap} (with `papers` for the authentic boxed look on a
 * plain background) and flip `inkOnly` per frame — no need to build a second
 * paper-less map. This is the multi-colour answer to the "black box bleed".
 *
 * @example
 * drawBitmapAttrs(ctx, HERO_BITMAP, HERO_ATTRS, hero.x, hero.y)
 * // Each 8×8 cell gets the (ink, paper) defined in HERO_ATTRS — yellow head,
 * // red body, blue legs — exactly like a Jet-Pac sprite crossing attribute cells.
 *
 * drawBitmapAttrs(ctx, HERO_BITMAP, HERO_ATTRS, hero.x, hero.y, true)
 * // Same per-cell inks, but no paper blocks — clean over a detailed background.
 */
export function drawBitmapAttrs(
  ctx: CanvasRenderingContext2D,
  bitmap: Bitmap,
  attrs: AttrMap,
  x: number, y: number,
  inkOnly = false,
): void {
  if (attrs.cols * 8 !== bitmap.width || attrs.rows * 8 !== bitmap.height) {
    throw new Error(
      `drawBitmapAttrs: attr dimensions ${attrs.cols}×${attrs.rows} (${attrs.cols * 8}×${attrs.rows * 8} px) ` +
      `do not match bitmap ${bitmap.width}×${bitmap.height}`,
    )
  }

  const bytesPerRow = bitmap.width / 8

  for (let cellRow = 0; cellRow < attrs.rows; cellRow++) {
    for (let cellCol = 0; cellCol < attrs.cols; cellCol++) {
      const cellIdx = cellRow * attrs.cols + cellCol
      const ink   = attrs.inks[cellIdx]
      const paper = attrs.papers ? attrs.papers[cellIdx] : undefined

      const cellX = x + cellCol * 8
      const cellY = y + cellRow * 8

      if (paper !== undefined && !inkOnly) {
        ctx.fillStyle = paper
        ctx.fillRect(cellX, cellY, 8, 8)
      }

      ctx.fillStyle = ink
      for (let row = 0; row < 8; row++) {
        const byteIdx = (cellRow * 8 + row) * bytesPerRow + cellCol
        const byte = bitmap.data[byteIdx]
        if (!byte) continue
        for (let bit = 0; bit < 8; bit++) {
          if (byte & (0x80 >> bit)) ctx.fillRect(cellX + bit, cellY + row, 1, 1)
        }
      }
    }
  }
}

/**
 * Returns a horizontally-flipped copy of an {@link AttrMap}. Within each row,
 * columns are swapped left↔right; row order is preserved.
 *
 * Pair with {@link mirrorBitmap} when deriving a left-facing variant of a
 * right-facing sprite so both the pixels AND the colour layout flip together.
 *
 * @example
 * export const HERO_RIGHT_BMP   = createBitmap(BYTES, 16, 24)
 * export const HERO_RIGHT_ATTRS = createAttrMap(2, 3, INKS, C.BLACK)
 * export const HERO_LEFT_BMP    = mirrorBitmap(HERO_RIGHT_BMP)
 * export const HERO_LEFT_ATTRS  = mirrorAttrMap(HERO_RIGHT_ATTRS)
 */
export function mirrorAttrMap(attrs: AttrMap): AttrMap {
  const { cols, rows, inks, papers } = attrs
  const newInks   = new Array<SpectrumColor>(inks.length)
  const newPapers = papers ? new Array<SpectrumColor>(papers.length) : undefined

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const srcIdx = r * cols + c
      const dstIdx = r * cols + (cols - 1 - c)
      newInks[dstIdx] = inks[srcIdx]
      if (newPapers) newPapers[dstIdx] = papers![srcIdx]
    }
  }

  return { cols, rows, inks: newInks, papers: newPapers }
}

/**
 * Flashes `document.body.style.backgroundColor` between `color` and `resetColor`.
 * Fire-and-forget — does not block. Uses `setInterval` internally.
 * One "flash" = one `color → resetColor` cycle; total steps = `times * 2`.
 * Always resets to `resetColor` on completion.
 *
 * @param color      - Flash color (`C.*` palette value)
 * @param times      - Number of flashes
 * @param intervalMs - Duration of each half-cycle in milliseconds
 * @param resetColor - Final color after flashing (default `C.BLACK`)
 *
 * @example
 * flashBorder(C.B_RED, 3, 150)           // explosion — 3 red flashes → black
 * flashBorder(C.B_GREEN, 2, 200)         // level complete
 * flashBorder(C.B_CYAN, 2, 120, C.BLUE)  // flash → reset to blue border
 */
let _flashRafId: number | null = null

export function flashBorder(
  color: SpectrumColor,
  times: number,
  intervalMs: number,
  resetColor: SpectrumColor = C.BLACK,
): void {
  // Cancel any in-flight flash so we never have two RAF loops fighting over body bg
  if (_flashRafId !== null) {
    cancelAnimationFrame(_flashRafId)
    _flashRafId = null
  }
  const start = performance.now()
  const totalSteps = times * 2

  const tick = (now: number) => {
    const elapsed = now - start
    const N = Math.floor(elapsed / intervalMs)

    if (N >= totalSteps) {
      // Animation finished — write final reset and stop scheduling
      document.body.style.backgroundColor = resetColor
      _flashRafId = null
      return
    }

    // N === 0 → still in the pre-flash wait window; don't touch background yet
    // N >= 1 → alternate color (odd N) / resetColor (even N)
    if (N >= 1) {
      document.body.style.backgroundColor = (N % 2 === 1) ? color : resetColor
    }

    _flashRafId = requestAnimationFrame(tick)
  }

  _flashRafId = requestAnimationFrame(tick)
}
