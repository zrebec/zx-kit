import { C, CELL, type SpectrumColor } from './palette.js'
import { getCharRow } from './font.js'

function drawBitmap(
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
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.scale(scale, scale)
  return ctx
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
  drawBitmap(ctx, row => sprite[row], x, y)
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
  drawBitmap(ctx, row => getCharRow(code, row), x, y)
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
 * const centered = (ctx: CanvasRenderingContext2D, text: string, y: number, ink: string) =>
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
 * Flashes `document.body.style.backgroundColor` between `color` and `resetColor`.
 * Fire-and-forget — does not block. Uses `setInterval` internally.
 * One "flash" = one `color → resetColor` cycle; total steps = `times * 2`.
 * Always resets to `resetColor` on completion.
 *
 * @param color      - Flash color (`C.*` palette value )
 * @param times      - Number of flashes
 * @param intervalMs - Duration of each half-cycle in milliseconds
 * @param resetColor - Final color after flashing (default `C.BLACK`)
 *
 * @example
 * flashBorder(C.B_RED, 3, 150)           // explosion — 3 red flashes → black
 * flashBorder(C.B_GREEN, 2, 200)         // level complete
 * flashBorder(C.B_CYAN, 2, 120, C.BLUE)  // flash → reset to blue border
 */
export function flashBorder(
  color: SpectrumColor,
  times: number,
  intervalMs: number,
  resetColor: SpectrumColor = C.BLACK,
): void {
  let step = 0
  const totalSteps = times * 2
  const id = setInterval(() => {
    document.body.style.backgroundColor = step % 2 === 0 ? color : resetColor
    step++
    if (step >= totalSteps) {
      clearInterval(id)
      document.body.style.backgroundColor = resetColor
    }
  }, intervalMs)
}
